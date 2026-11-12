# NODO 09 V3 · Respuesta y feedback

Actualización del 12 de noviembre de 2026 sobre el ZIP V3 de combate y suministros ya entregado y confirmado como fluido. Se conservaron todas sus funciones; esta entrega corrige la respuesta de apuntado, las viñetas, las bajas, las cajas y la pantalla de muerte. No se publicó ni modificó el repositorio remoto.

## Cambios de esta entrega

- **Curación:** capas verde y azul más amplias y visibles, detrás del HUD. Opacidad continua de 0.62–0.80, respiración de 0.9 s, entrada de 0.12 s y salida de 0.45 s. La mini conserva sus 2 s y el vendaje sus 3.5 s; no se cambia cuánto curan ni cuándo se consume el objeto. Las capas no reciben toques. La viñeta de daño y el pulso de salud baja también ganan intensidad.
- **Apuntado:** seguimiento continuo en ADS activado por defecto, opcional. Intensidad 0–4×, inicial 1.5×; alcance 5–110 m, inicial 90 m. La adquisición se revisa cada 25 ms y el objetivo actual se revalida cada paso físico. El seguimiento tiene una velocidad angular limitada y responde con fuerza sin desplazar el impacto fuera del rayo de la cámara. Sigue respetando paredes, aliados, protección y enemigos muertos; apartar deliberadamente la mira tiene prioridad. Puede usarse también con mouse activando su opción existente.
- **Autodisparo:** desaparece la espera artificial de 75 ms. Se habilita al superar el 65% de la transición visual ADS y encontrar un enemigo válido bajo el rayo real; la cadencia del arma, la recarga y los bloqueos de consumibles/interacción siguen vigentes. La prueba integrada elimina con un cartucho y no gasta otro contra el cadáver.
- **Preferencias:** se conservan sensibilidad, controles y distribuciones. Para configuraciones anteriores sin la revisión nueva, únicamente los valores predeterminados antiguos 0.85× / 30 m migran a 1.5× / 90 m. Los demás valores propios, incluido intensidad cero, se mantienen.
- **Bajas:** cuatro filas DOM reutilizadas. Cada entrada tiene tres segundos completos desde que aparece, luego 0.24 s de salida. Los eventos adicionales esperan en orden; al liberarse espacio, los siguientes empiezan su propio temporizador. Las filas suben con una transición de 0.22 s. Se mantienen nombres por equipo, variedad de frases y descarte al tocar. La prueba de ráfaga conserva las cien bajas enviadas sin superar cuatro filas visibles.
- **Cajas:** se sustituyó el bloque macizo por suelo, cuatro paredes finas y fondo oscuro. La bisagra levanta la tapa 107.7°; antes giraba hacia dentro. La apertura sigue siendo inmediata, como se había solicitado, y la caja permanece abierta/vacía hasta regenerarse. Las ocho cajas continúan en un solo lote instanciado, con 14 piezas ligeras por caja.
- **Autoabrir:** nueva opción persistente en AJUSTES → CONTROLES. Dentro de 3 m, mismo piso y sin pared intermedia, mantener la mirada sobre la caja completa el anillo de un segundo. Apartarse o mirar otro lugar cancela. El control manual conserva prioridad; no se inicia automáticamente mientras disparas, recargas o consumes.
- **Muerte:** desenfoque CSS de 5 px aplicado exclusivamente a la escena, acompañado por viñeta negra y luego roja. Controles y texto quedan nítidos. Título rojo grande con entrada suave y doce frases en baraja sin repetición hasta agotarse. La cuenta blanca de reaparición conserva su función y pierde el recuadro. Al reaparecer, las capas salen en 0.28 s y se retira el desenfoque.

## Movimiento y sistemas conservados

Comparación byte por byte con la entrega anterior: `physics.js`, `level.js`, `render.js`, `refinements.js`, `navigation.js`, `soldier.js`, `world-v2.js`, `input.js`, `combat.js`, `match.js`, `audio.js`, `hud.js` y `weapon-models.js` no cambiaron. Sus huellas SHA-256 están en `PRUEBAS.json`.

No hubo cambios inevitables ni ajustes al movimiento del jugador: FOV horizontal 100°, física 120 Hz, sprint 11.5 m/s, carrera 7.4 m/s, salto 8.6 m/s, gravedad 24 m/s², aceleración 46 m/s², slide, slide jump, inercia y colisiones originales. Se conservan bots articulados, cinco personalidades, tres dificultades, modos locales, 1–20 bots, tres armas, reservas finitas, daño/escudo, sonido espacial, editor HUD, miras, minimapa, marcadores, radar, flechas de aliados y botín/consumibles.

## Verificación ejecutada

| Conjunto | Resultado | Entorno y alcance |
|---|---:|---|
| Física | 24/24 | Node y Chrome: controlador real, rampas, escaleras, saltos, slide y conservación de impulso |
| Sistemas V3 | 48/48 | Node y Chrome: navegación, percepción, combate, equipos, reaparición, modelos y simulación de bots |
| Combate/suministros anteriores | 33/33 | Node y Chrome: armas, límites, consumibles, rayos, aliados, paredes, botín y miras |
| Respuesta nueva | 23/23 | Node y Chrome: seguimiento cercano/lejos, fuerza, respuesta inmediata, tiempos de viñetas, cola de cien bajas, tapa/hueco por matrices y raycasting, mirada/cancelación |
| Interfaz e integración | 73/73 | Chrome, DOM y Canvas 2D; ciclo real en diagnóstico sin WebGL; eventos sintéticos e iframes CSS 844×390 / 390×844 |
| Caché sin red | 5/5 | Node VM con Cache/Fetch simulados; worker real, 27 recursos, navegación, módulos y limpieza por ámbito |

**206 verificaciones distintas aprobadas.** Las 128 de lógica ejecutadas tanto en Node como en Chrome se cuentan una sola vez. La suite HUD incluye 54 casos anteriores y 19 nuevos, entre ellos apertura automática, consumo de mini, cola de bajas, desenfoque solo en escena, reaparición y ausencia de crecimiento DOM durante 120 actualizaciones. Se revisaron visualmente los gradientes verde/azul y la composición de muerte sobre un fondo neutro claro usando las capas CSS reales; ese fondo de diagnóstico no forma parte del juego.

También se verificaron sintaxis de JavaScript, referencias locales, licencia incluida, preservación de archivos y ZIP con todos sus recursos en la raíz. `tests.html` permite repetir lógica y `index.html?qa=1` permite repetir interfaz. El diagnóstico no sustituye a `index.html` para jugar.

## Rendimiento y límites de lo comprobado

No se añadieron dependencias, texturas grandes, shaders, luces ni sombras. Las viñetas usan gradientes y opacidad; no crean nodos por fotograma. La escena se desenfoca únicamente durante la eliminación. La caja conserva un lote de dibujo; la cola mantiene cuatro filas montadas y guarda solo datos para los eventos pendientes. Una partida con muchísimas bajas simultáneas puede retrasar la presentación de los últimos eventos, intencionalmente para conservarlos todos.

La prueba Chrome midió 0.0105 ms de CPU media para 200 actualizaciones del minimapa y una lectura aproximada de heap JavaScript de 10.97 MB al finalizar el tramo medido. Son lecturas puntuales del diagnóstico, no coste completo de la aplicación ni pruebas de ausencia absoluta de fugas.

El entorno de navegador disponible no tiene WebGL: se comprobaron geometría, matrices, raycasting, simulación y capas CSS, pero no se midieron FPS gráficos ni coste GPU/Safari. El desenfoque de muerte tiene un coste de composición y no se presenta como gratuito. La fluidez de una partida renderizada y el tacto en el dispositivo quedan como límites de esta validación; no se intentó acceso a un iPhone ni se prometen 60 FPS. No hay fallos conocidos dentro de los casos automatizados aprobados.

El seguimiento es una implementación propia para este juego local; no se afirma copiar un algoritmo privado de Fortnite. No permite ver a través de paredes ni fijar enemigos fuera del radio angular configurado. El máximo alcance ajustable no garantiza que haya una línea de visión tan larga en cada zona del mapa.

## Archivos y publicación

Añadidos: `verify-feedback.js`, `verify-feedback-ui.js`.

Modificados frente al último ZIP: `aim-support.js`, `combat-feedback.js`, `combat-ui.js`, `game.js`, `world-v3.js`, `supplies.js`, `preferences.js`, `settings-v2.js`, `index.html`, `style.css`, `sw.js`, `tests.html`, `verify-combat.js`, `README.md`, `INFORME.md` y `PRUEBAS.json`.

**41 archivos sueltos**, sin carpetas, rutas locales de desarrollo ni compilación. Three.js está incluido junto con su licencia. La versión de caché es `v3-feedback-20261112-2`. Reemplaza todos los archivos en GitHub Pages y cierra las pestañas antiguas para activar la nueva caché. Las instrucciones completas están en `README.md`.
