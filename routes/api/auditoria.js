const express = require('express');
const router = express.Router();
const Apuesta = require('../models/apuesta.model');
const User = require('../models/user.model');
const Screenshot = require('../models/screenshot.model');

/**
 * @route   POST /api/auditoria/corregir-ronda/:sala/:ronda
 * @desc    Audita y corrige los saldos de una ronda finalizada.
 *          Compara el cambio de saldo real (capturado en screenshots) 
 *          con el total de premios que se debieron pagar. Si hay una 
 *          discrepancia, la ajusta en el saldo del usuario ganador.
 * @access  Private (llamado desde el Gateway de NestJS)
 */
router.post('/corregir-ronda/:sala/:ronda', async (req, res) => {
  const { sala, ronda } = req.params;

  try {
    console.log(`[AUDITORIA] Iniciando auditoría para sala: ${sala}, ronda: ${ronda}`);

    // 1. Obtener los screenshots de inicio y fin de la ronda. Son nuestra "verdad absoluta".
    const screenshotInicio = await Screenshot.findOne({ sala, ronda: Number(ronda), momento: 'inicio' });
    const screenshotFinal = await Screenshot.findOne({ sala, ronda: Number(ronda), momento: 'final' });

    if (!screenshotInicio || !screenshotFinal) {
      console.error(`[AUDITORIA] Error: Faltan screenshots para la ronda ${ronda}. No se puede auditar.`);
      return res.status(404).json({ msg: 'No se encontraron los screenshots de inicio o fin para auditar.' });
    }

    // 2. Calcular la diferencia de saldo TOTAL observada en la ronda.
    const saldoInicialTotal = screenshotInicio.saldos.reduce((sum, s) => sum + s.saldo, 0);
    const saldoFinalReal = screenshotFinal.saldos.reduce((sum, s) => sum + s.saldo, 0);
    const diferenciaTotalObservada = saldoFinalReal - saldoInicialTotal;

    console.log(`[AUDITORIA] Saldo inicial total: ${saldoInicialTotal.toFixed(2)}`);
    console.log(`[AUDITORIA] Saldo final real: ${saldoFinalReal.toFixed(2)}`);
    console.log(`[AUDITORIA] Diferencia observada en saldos: ${diferenciaTotalObservada.toFixed(2)}`);

    // 3. Calcular cuánto dinero se DEBIÓ haber pagado según las apuestas ganadoras.
    const apuestasGanadoras = await Apuesta.find({ sala, ronda: Number(ronda), estado: 'ganada' });
    if (apuestasGanadoras.length === 0) {
        console.log(`[AUDITORIA] No hay apuestas ganadoras en esta ronda. Auditoría finalizada.`);
        return res.json({ msg: 'No hubo ganadores para auditar.', ganadores: [], correcciones: [] });
    }
    const totalPagadoSegunApuestas = apuestasGanadoras.reduce((sum, apuesta) => sum + apuesta.premio, 0);
    
    console.log(`[AUDITORIA] Total que debió pagarse (premios): ${totalPagadoSegunApuestas.toFixed(2)}`);

    // 4. Calcular la discrepancia.
    // Discrepancia = (Lo que realmente cambió en los saldos) - (Lo que debió cambiar)
    const discrepancia = diferenciaTotalObservada - totalPagadoSegunApuestas;

    console.log(`[AUDITORIA] Discrepancia calculada: ${discrepancia.toFixed(2)}`);

    // 5. Si hay una discrepancia significativa, corregirla.
    if (Math.abs(discrepancia) > 0.01) { // Usamos un umbral pequeño para evitar errores de punto flotante
      console.warn(`[AUDITORIA] ¡Discrepancia detectada! Se procederá a corregir.`);
      
      // La lógica más simple es ajustar el saldo del primer ganador encontrado.
      // En la mayoría de los casos, solo habrá un ganador.
      const usuarioAGanador = apuestasGanadoras[0].username;
      
      console.log(`[AUDITORIA] Ajustando saldo para el usuario: ${usuarioAGanador}. Monto de ajuste: ${-discrepancia}`);

      // La corrección es el inverso de la discrepancia.
      // Si la discrepancia es positiva (se pagó de más), restamos.
      // Si es negativa (se pagó de menos), sumamos.
      const correccion = -discrepancia;

      const usuario = await User.findOneAndUpdate(
        { name: usuarioAGanador },
        { $inc: { saldo: correccion } },
        { new: true }
      );

      console.log(`[AUDITORIA] Saldo del usuario ${usuarioAGanador} actualizado a: ${usuario.saldo.toFixed(2)}`);
      
      return res.json({
        msg: `Auditoría completada. Se corrigió una discrepancia de ${discrepancia.toFixed(2)} en el usuario ${usuarioAGanador}.`,
        ganadores: apuestasGanadoras.map(a => ({ usuario: a.username, premio: a.premio })),
        correcciones: [{
          usuario: usuarioAGanador,
          montoCorregido: correccion
        }]
      });

    } else {
      console.log(`[AUDITORIA] No se encontraron discrepancias significativas. Los saldos son correctos.`);
      return res.json({
        msg: 'Auditoría completada. No se encontraron discrepancias.',
        ganadores: apuestasGanadoras.map(a => ({ usuario: a.username, premio: a.premio })),
        correcciones: []
      });
    }

  } catch (error) {
    console.error('[AUDITORIA] Error catastrófico durante la auditoría:', error);
    res.status(500).send('Error interno del servidor durante la auditoría.');
  }
});

module.exports = router;
