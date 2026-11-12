# KINETIC FPS | NODO 09 · V3

Actualización de respuesta, viñetas y cajas · 12 de noviembre de 2026. Conserva el mapa, los bots articulados y la física de tu V3.

## Publicar desde el iPhone

1. Descomprime el ZIP en **Archivos**.
2. Sube **todos los archivos sueltos** a la raíz de `KINEtiK`, reemplazando los anteriores. No crees carpetas.
3. Mantén GitHub Pages en tu rama y `/(root)`. Espera a que termine la publicación.
4. Cierra todas las pestañas antiguas del juego y vuelve a abrir Pages para activar la nueva caché. Si todavía aparece la anterior, abre y cierra una vez más después de completar la descarga.
5. Pulsa **PRÁCTICA RÁPIDA**, o configura una partida. Usa horizontal en el teléfono.

Sin compilación, instalaciones, CDN ni backend. Three.js y su licencia están incluidos. Abre la página HTTPS de Pages: la vista previa HTML de Archivos no ejecuta los módulos. Tras una primera carga completa por HTTPS, los recursos de juego quedan disponibles sin conexión mientras Safari conserve la caché.

## Lo nuevo y cómo usarlo

- **Seguimiento fuerte:** AJUSTES → CONTROLES → Asistencia · Intensidad, de **0 a 4×**. Valor inicial **1.5×**, alcance inicial **90 m** (ajustable hasta 110 m). En ADS acompaña al enemigo aunque no muevas continuamente el dedo. Puedes desactivar «Seguimiento continuo en ADS» para exigir corrección manual. Una corrección decidida para apartarte sigue teniendo prioridad. Respeta paredes, equipos y protección de aparición.
- **Tus ajustes:** se conservan sensibilidad y distribución. Solo los antiguos valores predeterminados de asistencia (0.85× / 30 m) se actualizan a los nuevos; el resto de valores personalizados se conserva.
- **Autodisparo:** activa **AUTO ON** en el HUD (tecla **F**). Responde en cuanto el rayo apunta a un enemigo válido durante ADS, sin la espera extra anterior. Conserva la cadencia y deja de disparar al eliminarlo o perderlo. Empieza desactivado y guarda tu elección.
- **Mira K-09:** AJUSTES → RETÍCULA → Mira física K-09 permite cuadrada/circular. También hay ambas retículas de pantalla. La escopeta usa un cuadro más amplio.
- **Cajas:** a 3 m aparece **ABRIR**. Mantén el botón o **E** durante **1 segundo** hasta completar el anillo. Soltar cancela. La tapa se levanta inmediatamente como un baúl y permanece abierta, con el interior vacío, hasta la regeneración. Aparece el mismo botín de la versión anterior.
- **Autoabrir opcional:** AJUSTES → CONTROLES → «Abrir cajas al mantenerlas en la mira». A menos de 3 m, mira la caja durante **1 segundo**; apartar la mirada cancela el anillo. Está desactivado inicialmente; el botón/E sigue disponible.
- **Botín:** acércate a 1.6 m para recogerlo. Si tienes la reserva llena, permanece y aparece «Munición máx.». Lo que no quepa se conserva hasta la siguiente regeneración de esa caja.
- **Vendajes/miniescudos:** vienen en paquetes de **3**; caben hasta **9** de cada tipo. Aparecen junto al selector de armas. Toca una vez para usar uno: **+25 de vida en 3.5 s** o **+25 de escudo en 2 s**, hasta 100. Una barra y una viñeta verde/azul pronunciada muestran el consumo. El color respira suavemente cada 0.9 s, sin encenderse y apagarse; desaparece gradualmente al terminar. Cada uso necesita otro toque. Disparar, recargar o cambiar arma lo cancela sin gastar el objeto; moverte no lo cancela.
- **Recarga:** también puedes tocar el recuadro de munición. Su interruptor AUTO RECARGA sigue siendo independiente.
- **Combate:** viñeta roja reforzada por daño/vida baja y flechas blancas de aliados incluso detrás de paredes.
- **Bajas:** máximo **4** visibles, **3 s** cada una más una salida breve. Las demás esperan en cola, aparecen en orden y tienen sus propios tres segundos. Toca una fila para quitarla.
- **Eliminación:** escenario borroso, controles nítidos, bordes negros y rojos, doce mensajes rojos variados y cuenta de reaparición blanca sin recuadro. Todo se retira al reaparecer.
- **Minimapa:** un enemigo que dispara revela su última posición de disparo. Permanece 1.8 s y se desvanece hasta 3.2 s; vuelve a encenderse con nuevos disparos. No sigue a un enemigo oculto que dejó de disparar.

## Controles PC

| Acción | Tecla |
|---|---|
| Mover / caminar | WASD / Alt + WASD |
| Sprint | Shift |
| Deslizar / agacharse | C o Ctrl |
| Salto / slide jump | Espacio |
| Disparar / ADS | Click izquierdo / derecho |
| Recargar | R o tocar munición |
| FILO / K-09 / S-07 | 1 / 2 / 3 |
| Vendaje / miniescudo | 4 / 5 |
| Abrir caja | Mantener E |
| Autodisparo ADS | F |
| Modo de arma | B |
| Marcador / asistencia | Q / H |
| Pausa / liberar cursor | P / Escape |
| Reiniciar posición | Inicio / Home |

**Táctil:** joystick y área derecha de mirada; puedes arrastrar DISPARO mientras disparas. Sprint y ADS alternan con un toque. DESLIZA a velocidad inicia slide; despacio alterna agachado.

**HUD:** AJUSTES → CONTROLES → PERSONALIZAR HUD. Mueve, escala y cambia opacidad; hay perfiles horizontal/vertical. Autodisparo, consumibles y bajas también son personalizables. La flecha pliega la barra; Guardar/Cancelar no reinician al personaje.

## Sistemas conservados

Entrenamiento, todos contra todos y rojo/azul; 1–20 bots, cinco personalidades, tres dificultades, sin multijugador. K-09: **40 + 360**; S-07: **7 + 56**, corredera/táctico; FILO: **2.7 m**, un objetivo, sin atravesar paredes. Vida/escudo: **100/100**. Reaparición 3.2 s y protección 2.2 s, que termina al atacar. Sin daño aliado.

`INFORME.md` explica decisiones y límites; `PRUEBAS.json` registra las verificaciones. `tests.html` ejecuta las pruebas de lógica. `index.html?qa=1` es solo diagnóstico de HUD sin 3D; **para jugar abre index.html sin ese parámetro**.
