/**
 * Created by xxxzh on 16/11/29.
 */
const redis = require("redis");
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const url = 'mongodb://localhost:27017/questdb3';
const moment = require('moment');
const daoClient = redis.createClient();


// 创建一个用于订阅通知的client
const subscriberClient = redis.createClient();


// 创建一个用于存放调度的队列的client
const taskClient = redis.createClient();


// subscribe to key expire events on database 4
//default 0
//仅能监听expire key 无法监听到 del
subscriberClient.psubscribe("__keyevent@4__:expired");
//设置handle
daoClient.select(4, function (err, data) {
    if (err) {
        console.log(err);
    }
    console.log(data);
});
subscriberClient.on("pmessage", function (pattern, channel, expiredKey) {
    console.log("key [" + expiredKey + "] has expired");
    const id = expiredKey;
    console.log('HM|'+id);
    daoClient.hgetall('HM|' + id, function (err, value) {
        if (err) {
            console.log('err', err);
        } else {
            console.log(value);
            const state = value.state;
            const deadLine = value.deadLine;
            let dbList, handle;
            if (value.DB) {
                var db_result = value.DB;
                dbList = db_result.split('|');
                //https://docs.mongodb.com/manual/reference/connection-string/
                MongoClient.connect(url, function (err, db) {
                    if (err) {
                        console.log(err);
                    }
                    console.log("Connected correctly to server");
                    //squarequestion|update|state|1'
                    var qid = ObjectId(id);
                    var key = dbList[2];
                    var value = parseInt(dbList[3]);
                    //修改为state可调
                    db.collection(dbList[0]).updateOne({_id:qid},{$set: { state : value }},function (err) {
                        if(err){
                            console.log('err',err);
                        }
                        else{
                            daoClient.hset('HM|' + id,'state',1,function (err,data) {
                                if(err){
                                    console.log('set hash state err',err);
                                }else{
                                console.log('success');}
                                daoClient.quit();
                            })
                        }

                    });
                    db.close();
                });


            }
            if (value.handle) {
                handle = value.handle.split('|');
            }

        }
    });

});
    // daoClient.hgetall('key',function (err,value) {
    //     if(err){
    //         console.log('err',err);
    //     }else{
    //         console.log(value);
    //     }
    // });
    //{ field1: 'value', field2: 'value2' }

    // subscriberClient.quit();



// // // schedule ORDER_ID "order_1234" to expire in 10 seconds
// taskClient.select(0, function (err, data) {
//     if (err) {
//         console.log(err);
//     }
//     console.log(data);
// });
// var questid = '58297c819c0f44260b844d3b';
// var quest_deadLine =456;
// taskClient.hmset('HM|'+questid,'state','0','deadLine','123','DB','squarequestion|update|state|1',
//     function (err,res) {
//         if(err){
//             console.log(err);
//         }
//         console.log(res);
//     });
// taskClient.set(questid,'123',"PX",1000,redis.print);
// // taskClient.hmset("hosts", "mjr", "1", "another", "23", "home", "1234");
// taskClient.hgetall('HM|'+questid, function (err, obj) {
//     var obj = obj;
//     console.log( obj.db);
// });

// taskClient.set("58297c819c0f44260b844d3b", "", "PX", 1000, redis.print);
// // taskClient.set("order_12341", "", "PX", 1000, redis.print);
