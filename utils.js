/**
 * Created by Administrator on 2016/12/7.
 */
const crypto = require('crypto');

module.exports = {
    md5_sign:(pwd, encode)=>crypto.createHash('md5').update(pwd).digest(encode),
    sha1_sign:(pwd, encode)=>crypto.createHash('sha1').update(pwd).digest(encode),
};