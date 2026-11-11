# KINETIC FPS | NODO 09 · V3

Actualización de la V2 original: mismo mapa y movimiento, ahora con soldados articulados, combates locales, vida, escudo y munición limitada.

## Publicar desde el iPhone

1. Descomprime el ZIP en **Archivos**.
2. Sube **todos los archivos sueltos** a la raíz de `KINEtiK`, reemplazando los anteriores. No crees carpetas.
3. Mantén GitHub Pages en tu rama y `/(root)`. Espera a que termine la publicación y abre la dirección de Pages en Safari.
4. Pulsa **PRÁCTICA RÁPIDA**, o **CONFIGURAR PARTIDA** para elegir modo, bots, dificultad y equipo. Usa horizontal en el teléfono.

No hay compilación, instalaciones, CDN ni backend. Three.js y su licencia están incluidos. Abre la página HTTPS de Pages; la vista previa HTML de Archivos no ejecuta los módulos del juego.

La primera carga completa por HTTPS guarda los recursos para uso sin conexión. Para actualizar posteriormente, reemplaza los archivos y cierra las pestañas antiguas del juego antes de volver a abrirlo. Safari puede liberar cachés cuando necesita espacio.

## Controles

| Acción | PC |
|---|---|
| Mover / caminar | WASD / Alt + WASD |
| Sprint | Shift |
| Deslizar / agacharse | C o Ctrl |
| Saltar / slide jump | Espacio |
| Disparar / apuntar | Click izquierdo / derecho |
| Recargar | R |
| FILO / K-09 / S-07 | 1 / 2 / 3 |
| Cambiar modo del arma | B |
| Marcador / asistencia | Q / H |
| Pausa / liberar cursor | P / Escape |
| Volver al inicio | Inicio / Home |

**Táctil:** joystick izquierdo; arrastra a la derecha para mirar. Puedes arrastrar DISPARO mientras disparas. Sprint y ADS se alternan con un toque. DESLIZA inicia slide a velocidad; despacio alterna agachado. Las tres ranuras cambian de arma. Sprint automático sigue disponible.

## Partidas y equipo

Entrenamiento sin límite de tiempo, todos contra todos o rojo contra azul. De 1 a 20 bots, tres dificultades y cinco personalidades. Comienza con 4 bots; puedes subir la cantidad desde Partida. La opción IA adaptativa reduce la frecuencia de decisiones cuando baja la fluidez, sin cambiar el movimiento del jugador.

Vida **100** y escudo **100**. Reaparición a los **3.2 s** con protección de **2.2 s**, que termina al atacar. Sin daño aliado.

- **K-09:** 40 cartuchos + 360 de reserva; auto/semi. AUTO RECARGA se activa dentro del indicador de munición.
- **S-07:** 7 cartuchos + 56 de reserva; modo corredera/táctico. Recarga individual, interrumpible si queda munición.
- **FILO:** tres ataques alternados, agarre invertido; alcance horizontal circular de 2.7 m, un enemigo por golpe, sin atravesar paredes ni golpear otro piso.
- **Cajas:** acércate para recoger munición que te falte. La tapa queda abierta hasta regenerar; tiempo configurable en Partida.

## HUD y sonido

**AJUSTES → Controles → Personalizar HUD.** Arrastra un elemento y cambia tamaño/opacidad. La flecha central pliega la barra sin cerrar el editor. Guardar, Cancelar, Restaurar y Vista previa conservan el personaje en pausa. Horizontal y vertical tienen distribuciones independientes; se mantienen tus ajustes de V2.

Vida, escudo, puntuación y estado de partida también se editan. Retícula incluye círculo fino. Audio tiene volúmenes separados para efectos, armas, pasos, ambiente e interfaz.

`INFORME.md` detalla implementación y límites. `PRUEBAS.json` contiene resultados reales. `tests.html` ejecuta pruebas reproducibles; `index.html?qa=1` es exclusivamente diagnóstico de HUD sin 3D. **Para jugar no uses `?qa=1`.**
