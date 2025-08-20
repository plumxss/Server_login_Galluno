const router = require('express').Router();
const apuestaModel = require('../../models/apuestas.model');
const userModel = require('../../models/user.model');
const eliminarCentavos = (monto) => Math.floor(monto); // 10.99 → 10

router.get('/obtenerapuestas', async (req, res) => {
    res.send("hola");
});

router.put('/repartirGanancias/:sala/:ronda/:ganador', async (req, res) => { 
  try {
    const sala = req.params.sala;
    const ronda = Number(req.params.ronda); // Asegurar que sea un número
    const ganador = req.params.ganador.toLowerCase(); // Convertir a minúsculas para evitar problemas de mayúsculas

    // Validar que el color ganador sea 'rojo' o 'verde'
    if (ganador !== 'rojo' && ganador !== 'verde') {
      return res.status(400).json({ error: "El color ganador debe ser 'rojo' o 'verde'." });
    }

    // Obtener todas las apuestas de la sala y ronda especificadas con estado "cazada"
    const apuestas = await apuestaModel.find({ sala, ronda, estado: 'cazada' });

    if (apuestas.length === 0) {
      return res.json({ message: "No hay apuestas cazadas para esta sala y ronda." });
    }

    // Filtrar solo las apuestas que coincidan con el color ganador
    const apuestasGanadoras = apuestas.filter(apuesta => 
      (ganador === 'rojo' && apuesta.rojo !== '') || 
      (ganador === 'verde' && apuesta.verde !== '')
    );

    if (apuestasGanadoras.length === 0) {
      return res.json({ message: "No hay apuestas ganadoras para este color." });
    }

    // Procesar cada apuesta ganadora y actualizar el saldo del usuario correspondiente
    await Promise.all(apuestasGanadoras.map(async (apuesta) => {
      const { username, cantidad } = apuesta;
      const comisionBanca = (cantidad * 0.1); // Aplicar el 10% de comisión   
      const montoGanado = (cantidad * 2) - comisionBanca; // Aplicar el 10% de comisión
      console.log("monto ganado: ", montoGanado)
      // Validar que el monto sea un número válido
      if (isNaN(montoGanado) || montoGanado <= 0) {
        console.warn(`Monto inválido para usuario ${username}: ${cantidad}`);
        return;
      }

      // Actualizar el saldo del usuario
      await userModel.findOneAndUpdate(
        { username },
        { $inc: { saldo: montoGanado } }, // Incrementa el saldo en el monto ganado
        { new: true }
      );
      // Enviar comision a la banca
      await userModel.findOneAndUpdate(
        { username: 'BANCA' },
        { $inc: { saldo: comisionBanca } },
        { new: true } // upsert: true crea el usuario si no existe
      );

      // Actualizar el estado de la apuesta a 'pagada'
      await apuestaModel.findByIdAndUpdate(apuesta._id, { 
        estado: 'pagada' ,
      cantidadOriginal: apuesta.cantidad,
        colorOriginal: apuesta.rojo ? 'rojo' : 'verde',
        fechaCierre: new Date()});
    }));

    res.json({ success: "Ganancias repartidas exitosamente." });
  } catch (error) {
    console.error('Error al repartir ganancias:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/obtenerapuestasBySalaRonda/:sala/:ronda', async (req, res) => {
  try {
    const sala = req.params.sala;
    const ronda = Number(req.params.ronda);
    // Buscar todos los apuestas que coincidan con la sala
    const apuestas = await apuestaModel.find({ sala, ronda });
    if (apuestas.length === 0) {
      return res.json({});
    }
    // Si no necesitas modificar las apuestas, no hace falta usar Promise.all
    const apuestasProcesadas = await Promise.all(apuestas.map(async (apuesta) => {
      return apuesta;
    }));
    res.json(apuestasProcesadas);
  } catch (error) {
    console.error('Error al obtener apuestas por sala:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
router.get('/obtenerapuestasBySala/:sala', async (req, res) => {
  try {
    const sala = req.params.sala;

    // Buscar todos los apuestas que coincidan con la sala
    const apuestas = await apuestaModel.find({ sala });

    if (apuestas.length === 0) {
      return res.json({});
    }

    // Si no necesitas modificar las apuestas, no hace falta usar Promise.all
    const apuestasProcesadas = await Promise.all(apuestas.map(async (apuesta) => {
      return apuesta;
    }));

    res.json(apuestasProcesadas);
  } catch (error) {
    console.error('Error al obtener apuestas por sala:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
  
router.post('/enviarapuesta', async (req, res) => {
  try {
    // Construir la apuesta a guardar en la base de datos
    const cantidad = eliminarCentavos(Number(req.body.cantidad));//Nos aseguramos de que solo sean num enteros 
    const newBet = new apuestaModel({
      username: req.body.username,
      rojo: req.body.rojo,
      verde: req.body.verde,
      cantidad: cantidad, // Asegurarse de que sea un número
      fecha: req.body.date,
      sala: req.body.room,
      ronda: req.body.ronda,
      estado: req.body.estado || 'en_espera' // Incluir el estado
    });

    // Guardar la apuesta en la base de datos
    await newBet.save();
    console.log(newBet);

    // Responder al cliente con éxito y el ID de la apuesta
    return res.json({ data: "Apuesta ingresada!", apuestaId: newBet._id });
  } catch (error) {
    console.error('Error al procesar la solicitud POST:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

  router.delete('/borrarapuesta/:id', async (req, res) => {
    try {
      const apuestaId = req.params.id;
  
      // Verificar si el apuesta existe antes de intentar borrarlo
      const apuestaExistente = await apuestaModel.findById(apuestaId);
      if (!apuestaExistente) {
        return res.status(404).json({ error: 'apuesta no encontrado' });
      }
  
      // Borrar el apuesta
      //await apuestaModel.findByIdAndDelete(apuestaId);
  
      res.json({ apuesta: 'apuesta borrado exitosamente' });
    } catch (error) {
      console.error('Error al borrar el apuesta:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
///EMPATE
router.put('/devolverApuestas/:sala/:ronda', async (req, res) => {
  try {
    const sala = req.params.sala;
    const ronda = Number(req.params.ronda);

    // Obtener todas las apuestas de la sala y ronda especificadas
    const apuestas = await apuestaModel.find({ sala, ronda, estado: { $nin: ['devuelta', 'pagada'] } });

    if (apuestas.length === 0) {
      return res.json({ message: "No hay apuestas para esta sala y ronda." });
    }

    // Agrupar las apuestas por usuario y sumar el total
    const apuestasPorUsuario = apuestas.reduce((acc, apuesta) => {
      if (!acc[apuesta.username]) {
        acc[apuesta.username] = 0;
      }
      acc[apuesta.username] += apuesta.cantidad;
      return acc;
    }, {});

    // Devolver las apuestas a los usuarios
    await Promise.all(Object.keys(apuestasPorUsuario).map(async (username) => {
      const cantidadTotal =  eliminarCentavos(apuestasPorUsuario[username]); //Aplicar el redondeo para la cantidad total de la apuesta 
      const user = await userModel.findOne({ username });
      if (user) {
        user.saldo += cantidadTotal;
        await user.save();
      }
    }));

    // Actualizar el estado de todas las apuestas a 'devuelta'
    await apuestaModel.updateMany({ sala, ronda, estado: { $nin: ['devuelta', 'pagada'] } }, { estado: 'devuelta' });

    res.json({ message: "Apuestas devueltas exitosamente." });
  } catch (error) {
    console.error('Error al devolver las apuestas:', error);
    res.status(500).json({ error: 'Error al devolver las apuestas.' });
  }
});

router.put('/actualizarEstadoApuesta', async (req, res) => {
  try {
    const { id, estado } = req.body;

    // Actualizar el estado de la apuesta
    await apuestaModel.findByIdAndUpdate(id, { estado });

    res.json({ message: "Estado de la apuesta actualizado exitosamente." });
  } catch (error) {
    console.error('Error al actualizar el estado de la apuesta:', error);
    res.status(500).json({ error: 'Error al actualizar el estado de la apuesta.' });
  }
});

router.put('/devolverApuestasEnEspera/:sala/:ronda', async (req, res) => {
  try {
    const sala = req.params.sala;
    const ronda = Number(req.params.ronda);

    // Obtener todas las apuestas en espera de la sala y ronda especificadas
    const apuestasEnEspera = await apuestaModel.find({ sala, ronda, estado: 'en_espera' });

    if (apuestasEnEspera.length === 0) {
      return res.json({ message: "No hay apuestas en espera para esta sala y ronda." });
    }

    // Agrupar las apuestas por usuario y sumar el total
    const apuestasPorUsuario = apuestasEnEspera.reduce((acc, apuesta) => {
      if (!acc[apuesta.username]) {
        acc[apuesta.username] = 0;
      }
      acc[apuesta.username] += apuesta.cantidad;
      return acc;
    }, {});

    // Devolver las apuestas a los usuarios
    await Promise.all(Object.keys(apuestasPorUsuario).map(async (username) => {
      const cantidadTotal = eliminarCentavos(apuestasPorUsuario[username]); // Añadir redondeo
      const user = await userModel.findOne({ username });
      if (user) {
        user.saldo += cantidadTotal;
        await user.save();
      }
    }));

    // Actualizar el estado de todas las apuestas a 'devuelta'
    await apuestaModel.updateMany({ sala, ronda, estado: 'en_espera' }, { estado: 'devuelta' });

    res.json({ message: "Apuestas en espera devueltas exitosamente." });
  } catch (error) {
    console.error('Error al devolver las apuestas en espera:', error);
    res.status(500).json({ error: 'Error al devolver las apuestas en espera.' });
  }
});

router.put('/restarSaldo', async (req, res) => {
  try {
    const { username, cantidad } = req.body;

    // Buscar al usuario por su username
    const user = await userModel.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Validar que el usuario tenga suficiente saldo para restar
    if (user.saldo < cantidad) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Calcular el nuevo saldo
    const cantidadRedondeada = eliminarCentavos(cantidad);
      const saldoNuevo = eliminarCentavos(user.saldo - cantidadRedondeada); // Redondear resultado

    // Actualizar el saldo del usuario
    const updatedUser = await userModel.findOneAndUpdate(
      { username },
      { $set: { saldo: saldoNuevo } },
      { new: true }  // Para devolver el usuario actualizado
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Respuesta de éxito con el saldo actualizado
    res.json({ success: 'Saldo actualizado', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/actualizarCantidadApuesta', async (req, res) => {
  try {
    const { id, cantidad } = req.body;
     const cantidadRedondeada = eliminarCentavos(cantidad); // Redondear

    // Validar que el monto sea un número válido
    if (isNaN(cantidadRedondeada) || cantidadRedondeada <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número positivo' });
    }

    // Actualizar la cantidad de la apuesta
    const apuestaActualizada = await apuestaModel.findByIdAndUpdate(
      id,
      { $set: { cantidad: cantidadRedondeada } },
      { new: true }
    );

    if (!apuestaActualizada) {
      return res.status(404).json({ error: 'Apuesta no encontrada' });
    }

    res.json({ success: "Cantidad de la apuesta actualizada exitosamente.", apuesta: apuestaActualizada });
  } catch (error) {
    console.error('Error al actualizar la cantidad de la apuesta:', error);
    res.status(500).json({ error: 'Error al actualizar la cantidad de la apuesta.' });
  }
});

router.put('/aumentarSaldo', async (req, res) => {
  try {
    const { username, cantidad } = req.body;
     const cantidadRedondeada = eliminarCentavos(cantidad); // Redondear

    // Validar que el monto sea un número válido
    if (isNaN(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número positivo' });
    }

    // Actualizar el saldo del usuario
    const updatedUser = await userModel.findOneAndUpdate(
      { username },
      { $inc: { saldo: cantidadRedondeada } }, // Incrementa el saldo en el monto especificado
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Respuesta de éxito con el saldo actualizado
    res.json({ success: 'Saldo aumentado exitosamente', user: updatedUser });
  } catch (error) {
    console.error('Error al aumentar el saldo del usuario:', error);
    res.status(500).json({ error: error.message });
  }
});
router.get('/historialDetallado/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    // Verificar si el usuario existe y obtener apuestas en paralelo
    const [usuario, apuestas] = await Promise.all([
      userModel.findOne({ username }).select('_id').lean(),
      apuestaModel.find({ username })
        .sort({ fecha: -1 })
        .select('_id fecha sala ronda cantidad rojo verde estado')
        .lean()
    ]);

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Procesar apuestas
    const historial = apuestas.map(apuesta => {
      const esGanada = apuesta.estado === 'pagada';
      const esEmpate = apuesta.estado === 'devuelta';
      
      return {
        ...apuesta,
        colorApostado: apuesta.rojo ? 'rojo' : 'verde',
        resultado: esGanada ? 'ganada' : esEmpate ? 'empate' : 'perdida',
        ganancia: esGanada ? apuesta.cantidad * 1.9 : esEmpate ? apuesta.cantidad : 0,
        perdida: !esGanada && !esEmpate ? apuesta.cantidad : 0
      };
    });

    // Calcular resumen
    const resumen = historial.reduce((acc, item) => {
      acc.totalGanado += item.ganancia;
      acc.totalPerdido += item.perdida;
      acc.balance = acc.totalGanado - acc.totalPerdido;
      return acc;
    }, { totalGanado: 0, totalPerdido: 0, balance: 0 });

    res.json({ success: true, username, historial, resumen });

  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

router.get('/historialPorRondas/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    // Verificar si el usuario existe y obtener apuestas (excluyendo devoluciones)
    const [usuario, apuestas] = await Promise.all([
      userModel.findOne({ username }).select('username saldo').lean(),
      apuestaModel.find({ 
        username, 
        estado: { $ne: 'devuelta' } // Excluir devoluciones
      })
        .sort({ fecha: -1 })
        .select('fecha sala ronda cantidad rojo verde estado')
        .lean()
    ]);

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Agrupar por sala, ronda Y color
    const rondasColorMap = {};
    
    apuestas.forEach(apuesta => {
      const color = apuesta.rojo ? 'ROJO' : 'VERDE';
      const key = `${apuesta.sala}-${apuesta.ronda}-${color}`;
      
      if (!rondasColorMap[key]) {
        rondasColorMap[key] = {
          sala: apuesta.sala,
          ronda: apuesta.ronda,
          color: color,
          fecha: apuesta.fecha,
          totalApostado: 0, // Total apostado a este color en esta ronda
          totalGanado: 0,   // Total ganado si hubo ganancias
          totalPerdido: 0,  // Total perdido si hubo pérdidas
          hayGanadas: false,
          hayPerdidas: false
        };
      }
      
      // Actualizar fecha si es más reciente
      if (new Date(apuesta.fecha) > new Date(rondasColorMap[key].fecha)) {
        rondasColorMap[key].fecha = apuesta.fecha;
      }
      
      // Siempre sumar al total apostado
      rondasColorMap[key].totalApostado += apuesta.cantidad;
      
      const esGanada = apuesta.estado === 'pagada';
      
      if (esGanada) {
        rondasColorMap[key].totalGanado += apuesta.cantidad * 0.9; // Solo la ganancia neta (sin lo apostado)
        rondasColorMap[key].hayGanadas = true;
      } else {
        rondasColorMap[key].totalPerdido += apuesta.cantidad;
        rondasColorMap[key].hayPerdidas = true;
      }
    });

    // Convertir a array y procesar cada ronda-color
    const historial = Object.values(rondasColorMap)
      .map(rondaColor => {
        // Determinar resultado neto
        let cantidadFinal;
        let resultadoNeto;
        
        if (rondaColor.hayGanadas && !rondaColor.hayPerdidas) {
          // Solo ganancias
          cantidadFinal = rondaColor.totalGanado;
          resultadoNeto = 'Gana';
        } else if (!rondaColor.hayGanadas && rondaColor.hayPerdidas) {
          // Solo pérdidas
          cantidadFinal = -rondaColor.totalPerdido;
          resultadoNeto = 'Pierde';
        } else if (rondaColor.hayGanadas && rondaColor.hayPerdidas) {
          // Mixto: calcular resultado neto
          const neto = rondaColor.totalGanado - rondaColor.totalPerdido;
          cantidadFinal = neto;
          resultadoNeto = neto > 0 ? 'Gana' : 'Pierde';
        } else {
          // No debería llegar aquí, pero por seguridad
          cantidadFinal = 0;
          resultadoNeto = 'Pierde';
        }
        
        return {
          concepto: `P${rondaColor.ronda}`,
          fecha: rondaColor.fecha,
          sala: rondaColor.sala,
          ronda: rondaColor.ronda,
          cantidad: rondaColor.totalApostado, // Total apostado a este color
          color: rondaColor.color,
          queda: resultadoNeto,
          cantidadFinal: cantidadFinal, // Resultado neto (ganancia total o pérdida negativa)
          estado: rondaColor.hayGanadas && rondaColor.hayPerdidas ? 'mixto' : 
                  rondaColor.hayGanadas ? 'pagada' : 'cazada'
        };
      })
      .sort((a, b) => {
        // Ordenar primero por fecha (más reciente primero), luego por ronda, luego por color
        const fechaCompare = new Date(b.fecha) - new Date(a.fecha);
        if (fechaCompare !== 0) return fechaCompare;
        
        const rondaCompare = b.ronda - a.ronda;
        if (rondaCompare !== 0) return rondaCompare;
        
        // Si es la misma ronda, poner ROJO primero, luego VERDE
        if (a.color === 'ROJO' && b.color === 'VERDE') return -1;
        if (a.color === 'VERDE' && b.color === 'ROJO') return 1;
        return 0;
      });

    // Calcular resumen total
    const resumen = historial.reduce((acc, item) => {
      acc.totalApostado += item.cantidad;
      if (item.cantidadFinal > 0) {
        acc.totalGanado += item.cantidadFinal;
        acc.registrosGanados++;
      } else {
        acc.totalPerdido += Math.abs(item.cantidadFinal);
        acc.registrosPerdidos++;
      }
      acc.balance = acc.totalGanado - acc.totalPerdido;
      return acc;
    }, { 
      totalApostado: 0,
      totalGanado: 0, 
      totalPerdido: 0, 
      balance: 0,
      registrosGanados: 0,
      registrosPerdidos: 0,
      totalRegistros: historial.length,
      saldoActual: usuario.saldo
    });

    res.json({ 
      success: true, 
      username: usuario.username, 
      historial, 
      resumen 
    });

  } catch (error) {
    console.error('Error al obtener historial por rondas:', error);
    res.status(500).json({ error: 'Error al obtener historial por rondas' });
  }
});

//End point para el resumen de las apuestas 
router.get('/resumen-stream/:sala', async (req, res) => {
  try {
    const sala = req.params.sala;
    
    // Buscar solo apuestas con estado 'cazada' para calcular el total cazado
    const apuestas = await apuestaModel.find({ 
      sala, 
      estado: 'cazada'
    });

    // Calcular total cazado por ronda (suma de todas las apuestas cazadas)
    const totalPorRonda = apuestas.reduce((acc, apuesta) => {
      const ronda = apuesta.ronda || 0;
      if (!acc[ronda]) {
        acc[ronda] = 0;
      }
      
      // Sumar la cantidad de la apuesta (sin importar el color)
      acc[ronda] += Math.floor(apuesta.cantidad);
      
      return acc;
    }, {});

    // Calcular el total general y preparar detalles
    const totalStream = Object.values(totalPorRonda).reduce((sum, cantidad) => sum + cantidad, 0);
    
    const resultado = {
      totalStream: totalStream,
      detalles: Object.keys(totalPorRonda).map(ronda => ({
        ronda: Number(ronda),
        cazado: totalPorRonda[ronda]
      })).sort((a, b) => b.ronda - a.ronda)
    };

    res.json(resultado);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/obtenerapuestasAgrupadasBySala/:sala', async (req, res) => {
  try {
    const sala = req.params.sala;

    // Buscar todas las apuestas que coincidan con la sala
    const apuestas = await apuestaModel.find({ sala });

    if (apuestas.length === 0) {
      return res.json({});
    }

    // Agrupar apuestas por usuario, estado y ronda
    const apuestasAgrupadas = {};

    apuestas.forEach(apuesta => {
      const key = `${apuesta.username}_${apuesta.estado}_${apuesta.ronda}`;
      
      if (!apuestasAgrupadas[key]) {
        apuestasAgrupadas[key] = {
          username: apuesta.username,
          estado: apuesta.estado,
          ronda: apuesta.ronda,
          cantidadTotal: 0,
          numeroApuestas: 0,
          roja: '',
          verde: '',
          sala: apuesta.sala,
          fechaUltima: apuesta.fecha
        };
      }

      // Sumar la cantidad total
      apuestasAgrupadas[key].cantidadTotal += apuesta.cantidad;
      apuestasAgrupadas[key].numeroApuestas += 1;
      
      // Actualizar colores (mantener el último o combinar)
      if (apuesta.rojo) apuestasAgrupadas[key].roja = apuesta.rojo;
      if (apuesta.verde) apuestasAgrupadas[key].verde = apuesta.verde;
      
      // Actualizar fecha si es más reciente
      if (new Date(apuesta.fecha) > new Date(apuestasAgrupadas[key].fechaUltima)) {
        apuestasAgrupadas[key].fechaUltima = apuesta.fecha;
      }
    });

    // Convertir el objeto a array y ordenar
    const resultado = Object.values(apuestasAgrupadas)
      .sort((a, b) => {
        // Ordenar por ronda descendente, luego por username, luego por estado
        if (a.ronda !== b.ronda) {
          return b.ronda - a.ronda; // Rondas más recientes primero
        }
        if (a.username !== b.username) {
          return a.username.localeCompare(b.username);
        }
        return a.estado.localeCompare(b.estado);
      });

    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener apuestas agrupadas por sala:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;