
const express = require("express");
require('dotenv').config();
require('./config/db');

const app = express();

//CONFIG

const cors = require('cors');
app.use(cors());

//app.use(express.bodyParser({limit: '50mb'}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

//GET /api/
app.use('/api', require('./routes/api'));

app.get('/', (req, res) => {

    res.send("holla");
})


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});



