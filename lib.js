/**
 * Created by Administrator on 2016/12/19.
 */
const utils = require('./utils');
const moment = require('moment');
const redis = require("redis");
const mongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const request = require('request');
//创建定时任务

function CornTab() {
    this.createRedis = createRedis;
    this.create = create;
    this.subscribeClient = subscribeClient;
    this.task = task;
    this.fieldParse = fieldParse;
    this.fieldBuild= fieldBuild;
    //result 0:失败 1:成功
    this.success= success;
    this.fail = fail;
}
//options 设置用于监听的redis客户端配置
function subscribeClient(options) {
    let subscribeClient = this.createRedis(options);
    let self = this;
    console.log(options);
    if (!options) {
        subscribeClient.psubscribe("__keyevent@0__:expired");
        console.log("__keyevent@0__:expired");
    } else {
        const db = options.db || 0;
        subscribeClient.psubscribe("__keyevent@" + db + "__:expired");
        console.log("__keyevent@" + db + "__:expired");
    }
    subscribeClient.on("pmessage", function (pattern, channel, expiredKey) {
        // console.log("key [" + expiredKey + "] has expired");
        self.task(expiredKey, options);
        //持续监听 保持端口连接
        //subscribeClient.quit();
    });
}
function task(expiredKey, options) {
    let taskClient = this.createRedis(options);
    let task = {};
    let self = this;
    console.log('expiredKey=', expiredKey);
    taskClient.hgetall('HM|' + expiredKey, function (err, data) {
        if (err) {
            console.log(err);
        }
        task = data;
        console.log('task.type',task.type);
        switch (task.type){
            case 'mongodb_updateOne':
                mongoClient.connect(task.url).then(function (db) {
                    console.log("Connected correctly to server");
                    let field = self.fieldParse(task.field);
                    console.log('field',field);
                    let selector = field.selector;
                    let body =field.body;
                    console.log('body',body);

                    db.collection(field.collection).updateOne(selector,{$set:body}).then(function (data) {
                        console.log('data',data.result);
                        self.success(taskClient,expiredKey);
                    }).catch(function (err) {
                        console.log(err);
                        self.fail(taskClient,expiredKey,err);
                    });

                    db.close();
                }).catch(function (err) {
                    console.log('err',err);
                    self.fail(taskClient,expiredKey,err);
                });
                break;
            case 'request_post':
                console.log('request_post');
                let field = self.fieldParse(task.field);
                request({
                        url:task.url,
                        method:'post',
                        body:JSON.stringify(field.body)
                    }
                    ,function (err,data) {
                        if(err){
                            console.log('err',err);
                            self.fail(taskClient,expiredKey,err);
                        }
                        else{
                            console.log('data',JSON.parse(data.body));
                            self.success(taskClient,expiredKey);
                        }
                    }
                );
                break;
            default:
                console.log('unknown');
        }
    });
}
//解析自定义结构field
//'collection|squarequestion;method|updateOne;params|{_id:qid},{$set: { state : value }}'
function fieldParse(str) {
    let result={};
    let itemList = str.split(';');
    for (let item of itemList){
        let tmp =item.split('|');
        //params|{_id:qid},{$set: { state : value }
        if(tmp[0]==='selector'){
            let selector = {};
            let kv=tmp[1].split(':');
            let key = kv[0];
            if(key.indexOf('_')>-1){
                selector[key.substr(1)]=ObjectId(kv[1]);
            }
            result.selector =selector;
        }else if(tmp[0]==='body'){
            result.body = JSON.parse(tmp[1]);
        }else {result[tmp[0]] = tmp[1];
        }
    }
    console.log('result',result);
    return result;
}
function fieldBuild(obj) {
    let keyList =Object.keys(obj);
    let result = '';
    while (keyList.length){
        let key =keyList.pop();
        let value = obj[key];
        if(key ==='body'){
            let value = JSON.stringify(value);
        }
        if(result){
            result +=';'+key+'|'+value;
        }else {
            result +=key+'|'+value;
        }
    }
    return result;
}
function success(client,expiredKey,message) {
    let body={
        resultCode:1,
        resultMsg:message||''
    };
    client.hmset('HM|'+expiredKey,body);
    client.quit();
}
function fail(client,expiredKey,message) {
    let body={
        resultCode:0,
        resultMsg:message||''
    };
    client.hmset('HM|'+expiredKey,body);
    client.quit();
}

//创建redis客户端
function createRedis(options) {
    let redisClient;
    if (!options) {
        redisClient = redis.createClient();
        return redisClient;

    }
    const host = options.host || 'localhost';
    const port = options.port || 6379;
    const path = options.path;
    const redisOptions = options.redisOptions;
    const db = options.db || 0;
    const password = options.password;

    if (path) {
        redisClient = redis.createClient(path, redisOptions);
    } else {
        redisClient = redis.createClient(port, host, redisOptions);
    }

    if (password) {
        redisClient.auth(password);
    }

    if (db) {
        redisClient.select(db);
    }
    return redisClient;
}
function create(options, client) {
    /**
     * param createTime 创建时间 mandatory
     * param execTime 执行时间 mandatory
     * param type 操作类型 mandatory
     * field 参数项 mandatory
     * resultCode 状态  012/ 0 未执行；1 成功；2 失败 mandatory 3
     * msg 错误信息 (optional)
     */
    if (!(options)) {
        return new Error('arguments is invalid');
    }
    let hashMap = {};
    hashMap.createTime = this.createTime = options.createTime;
    hashMap.execTime = this.execTime = options.execTime;
    hashMap.field = this.field = options.field;
    hashMap.type = this.type = options.type || undefined;
    hashMap.url = this.url = options.url;
    hashMap.resultCode = this.resultCode = 0;
    this.nonceStr = () => Math.random().toString(36).substr(2, 10);
    hashMap.nonceStr = this.nonceStr();
    let expire_key = utils.sha1_sign(this.createTime + this.execTime + this.type + this.nonceStr, 'base64');
    //单位ms
    let duration = moment(this.execTime) - moment(this.createTime);

    //设置定时任务计划
    client.hmset('HM|' + expire_key, hashMap,
        function (err, res) {
            if (err) {
                console.log(err);
            }
            console.log(res);
        });
    // client.hgetall('HM|'+expire_key,(err,data)=>{
    //     if(err){
    //         console.log('err',err);
    //     }else{
    //         console.log(data);
    //     }
    // });
    client.set(expire_key, hashMap.execTime, "PX", duration, function (err, res) {
        if (err) {
            console.error('err', err);
        } else {
            console.log(res);
        }
    });
    client.quit();
    console.log('expire_key', expire_key);
    console.log(duration);
}
module.exports =CornTab;
////////////////////////////////////////////////////////////////
// let t = moment().format();
// let ex = moment().add(2, 's').format();
// let opt = {
//     createTime: t,
//     execTime: ex,
//     url: 'mongodb://localhost:27017/questdb3',
//     field: 'collection|squarequestion;selector|__id:582c1cf2b80812a176ff035a;body|{"state":1}',
//     type: 'mongodb_updateOne'
// };
// let opt1 = {
//     createTime: t,
//     execTime: ex,
//     url: 'https://www.opt.com.cn/test',
//     field: 'body|{"questId":"5849192456a272c155a6bcdd"}',
//     type: 'request_post'
// };
// let a = new CornTab();
// const client = a.createRedis();
// let b = a.create(opt, client);
// a.subscribeClient({host: 'localhost'});
// let c=a.fieldParse('collection|squarequestion;selector|__id:582c1cf2b80812a176ff035a;body|{"state":1}');
// console.log(typeof c.selector._id);
// console.log(c.body);