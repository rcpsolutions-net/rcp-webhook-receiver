const crypto = require('crypto');

const secret = 'Af1c3b708OkScMWM5EQ7Byv+FJfs8X9nlUZWN7cZFxc=';

const message = 'your_request_payload';

const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');

console.log(signature);
