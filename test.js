/**
 * Created by xxxzh on 16/11/25.
 */
var events =  require("events");
var redis = require("redis");
var Scheduler = require('redis-scheduler');
const config = require('./config.json');

//设置重发策略
var retry_strategy=function (options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with a individual error
        return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands with a individual error
        return new Error('Retry time exhausted');
    }
    if (options.times_connected > 10) {
        // End reconnecting with built in error
        return undefined;
    }
    // reconnect after
    return Math.min(options.attempt * 100, 3000);
};
var createRedisClient = function (options) {
    var redisClient;
    var host = options.host||'localhost';
    var port = options.port|| 6379;
    var path = options.path;
    var redisOptions = options.redisOptions;
    var db = options.db;
    var password = options.password;

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
};
config.retry_strategy = retry_strategy;
const client = createRedisClient(config);
var corn_tab = function (task) {
    if(task){
    corn_tab.prototype.create_tab = function () {
        client.set()
    }}
};



var  x =new events.EventEmitter();

x.on('x', function(a,b,c){
    console.log("it's work1!"+a+b+c);
});
x.on('y', function(a,b,c){
    console.log('it\'s work2!'+a+b+c);
});
x.once('y', function(a,b,c){
    console.log('it\'s work3!'+a+b+c);
});
x.emit('y','111','222', '3333');
x.emit('y','1111','222', '3333');
var z = x.listeners('y');
console.log('z:'+z);