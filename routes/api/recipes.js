const router = require('express').Router();
const Recipe = require('../../models/recipe.model');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const helperImg = (filePath,fileName,size= 100) => {
    return sharp(filePath)
        //.resize(size,size)
        .toFile(`./imagenesRecipes/${fileName}`);

}

const storage = multer.diskStorage({
    destination:(req, file,cb) =>{
        cb(null,'./uploadsRecipes' )
    },
    filename:(req,file,cb) => {
        const ext = file.originalname.split('.').pop()
        cb(null, `${Date.now()}.png`)
    }

});
const upload = multer({storage
});

router.post('/upload', upload.single('file'), (req, res) => {

    console.log(req.file);
    helperImg(req.file.path, `resize-${req.file.filename}`)
    const path = `resize-${req.file.filename}`;

// Utilizamos split para obtener el nombre sin extensión y la extensión
    const [nombreSinExtension, extension] = path.split('.');

// Construimos el nuevo nombre del archivo
    const pathFinal = `${nombreSinExtension}.png`;

    res.send({ path: pathFinal})
});



router.post('/register', upload.single('file'), async (req, res) => {
     console.log('BODY:', req.body); // <-- Agrega esto
    try {

    
        // Proceso de carga de archivos
        if (req.file) {
            
            helperImg(req.file.path, `resize-${req.file.filename}`);
            const path = `resize-${req.file.filename}`;

            // Utilizamos split para obtener el nombre sin extensión y la extensión
            const [nombreSinExtension, extension] = path.split('.');

            // Construimos el nuevo nombre del archivo
            const pathFinal = `${nombreSinExtension}.png`;
            console.log(req.body);

            // Enviamos la respuesta
            const newRecipe = Recipe({
                username: req.body.username,
                monto: req.body.monto,
                image: pathFinal,
                banco: req.body.banco
            });

            await newRecipe.save();
            console.log(newRecipe);
            return res.json({ data:"Recibo ingresado!"} );
            
        } else {
            // No se cargó ningún archivo
            return res.json( {data:"No se envio ninguna imagen"} );
        }
    } catch (error) {
        return res.json({ error: error.message });
    }
});

router.get('/get-all-recipes', async (req, res) => {
    try {
        const Recipes = await Recipe.find({}); // Exclude password from the response
        res.json(Recipes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
   
});

router.get('/get-image/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Buscar al usuario en la base de datos
        const user = await Recipe.findOne({ _id: id });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Obtener el nombre de la imagen del usuario
        const imageName = user.image;

        if (!imageName) {
            return res.status(404).json({ error: 'Imagen no encontrada para este usuario' });
        }

        // Construir la ruta completa al archivo de imagen
        const imagePath = path.join(__dirname, '../../' ,'imagenesRecipes', imageName);
        console.log(imagePath);

        // Enviar la imagen como respuesta
        res.sendFile(imagePath, {}, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Error al enviar el archivo' });
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// Ruta para eliminar una receta por su _id
router.delete('/delete/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;

        // Buscar la receta en la base de datos
        const recipe = await Recipe.findById(recipeId);

        if (!recipe) {
            return res.status(404).json({ error: 'Recibo no encontrado' });
        }

        // Obtener el nombre de la imagen asociada a la receta
        const imageName = recipe.image;

        // Construir la ruta completa del archivo de imagen
        const imagePath = path.join(__dirname, '../../imagenesRecipes', imageName);

        // Eliminar el archivo de imagen si existe
        fs.unlink(imagePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                return res.status(500).json({ error: 'Error al eliminar la imagen' });
            }
        });

        // Eliminar la receta de la base de datos
        await Recipe.findByIdAndDelete(recipeId);

        return res.json({ message: 'Recibo eliminada exitosamente' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
router.put('/update-estado/:id', async (req, res) => {
    try {
        const { estado } = req.body;
        const recipeId = req.params.id;

        let updateFields = { estado };
        if (estado === 'aprobado') {
            updateFields.fechaAprobacion = new Date();
        }

        const recipe = await Recipe.findByIdAndUpdate(recipeId, updateFields, { new: true });
        if (!recipe) {
            return res.status(404).json({ error: 'Recibo no encontrado' });
        }
        return res.json({ message: 'Estado actualizado', recipe });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
router.delete('/delete-all-aceptados', async (req, res) => {
    try {
        // Busca todos los recibos aprobados
        const recibosAprobados = await Recipe.find({ estado: 'aprobado' });

        // Elimina las imágenes asociadas a cada recibo aprobado
        for (const recibo of recibosAprobados) {
            if (recibo.image) {
                const imagePath = path.join(__dirname, '../../imagenesRecipes', recibo.image);
                fs.unlink(imagePath, (err) => {
                    // Ignora error si el archivo no existe
                });
            }
        }

        // Elimina los recibos aprobados de la base de datos
        const result = await Recipe.deleteMany({ estado: 'aprobado' });

        res.json({ message: 'Historial de recibos aceptados eliminado', deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;