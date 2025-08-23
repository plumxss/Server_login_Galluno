const {model, Schema} = require("mongoose");


const userSchema = new Schema({
    username: String,
    password: String,
    email: String,
    image: String,
    rol: String,
    saldo: { type: Number, default:0},
    loginCode: String,
});


module.exports= model("user", userSchema);