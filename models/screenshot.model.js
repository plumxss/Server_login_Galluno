const {model, Schema} = require("mongoose");

const screenshotSchema = new Schema({
  usuario: {
    type: String,
    required: true
  },
  sala: {
    type: String,
    required: true
  },
  ronda: {
    type: String,
    required: true
  },
  saldo: {
    type: Number,
    required: true
  },
  momento: {
    type: String,
    enum: ['inicio', 'final'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports =  model('Screenshot', screenshotSchema); 
