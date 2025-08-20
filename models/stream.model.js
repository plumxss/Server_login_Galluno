const { Schema, model } = require('mongoose');


const streamSchema = new Schema({
    id: { 
        type: String, // CAMBIAR DE Number A String
        required: true,
        unique: true
    },
    titulo: String,
    clave: String,
    image: String,
    esVIP: Boolean,
}, { timestamps: true });


module.exports = model('Stream', streamSchema);