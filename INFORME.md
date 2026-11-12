# NODO 09 V3 · Combate y suministros

Entrega del 12 de noviembre de 2026. Proyecto completo, estático y sin multijugador. Esta actualización parte de la V3 previamente entregada y que el usuario confirmó fluida. Esa V3 deriva del repositorio real https://github.com/IzayTO/KINEtiK, V2 con commit `dcb6488e4c3e0cb6d42fa08e0cbbf77cbea207c2`. No se publicó ni modificó el repositorio remoto.

## Conservación

`physics.js`, `level.js`, `render.js`, `refinements.js`, `navigation.js`, `soldier.js` y `world-v2.js` mantienen exactamente sus bytes frente a la V3 entregada. No hubo cambios necesarios en el controlador del jugador ni en la distribución del mapa. Continúan el FOV horizontal de 100°, simulación a 120 Hz, sprint 11.5 m/s, carrera 7.4 m/s, salto 8.6 m/s, gravedad 24 m/s², aceleración 46 m/s² y todos los demás parámetros originales y personalizados. La entrada solo se amplió con nuevas acciones; no cambió su escala de sensibilidad.

Se conservan navegación, cinco personalidades, soldados Concepto 1 articulados, modos locales, protección de aparición, munición finita y las tres armas de V3. Los bots también pueden abrir cajas si necesitan recursos y consumir curación fuera de un enfrentamiento.

## Apuntado, disparo y miras

La intensidad admite 0–2× y la reducción de sensibilidad hasta 0.65. Los valores guardados se respetan. El seguimiento ADS corrige gradualmente hacia el pecho superior, con velocidad angular limitada, validación de distancia, equipo, protección y visibilidad. Solo continúa mientras hubo una corrección manual en los últimos 0.28 s; una corrección decidida para apartarse gana sobre la ayuda. No cambia fraudulentamente el impacto del disparo.

Autodisparo independiente, apagado por defecto y persistente: arma de fuego, ADS completo, enemigo vivo bajo el rayo real, sin aliados delante ni paredes. Reconocimiento breve de 75 ms, cadencia del arma, bloqueo durante apertura/consumo/recarga/cambio. El daño se resuelve dentro del paso físico para detener el fuego inmediatamente tras una baja, incluso si hay varios pasos físicos en un cuadro.

Es una implementación propia inspirada en la experiencia solicitada; no se afirma reproducir el algoritmo interno de Fortnite. Las referencias públicas de Epic documentan los ajustes de disparo y asistencia, no su algoritmo: https://www.epicgames.com/help/c-34254770/c-33726977/a22407677 y https://www.epicgames.com/help/c-34254770/c-33726977/a13648291?lang=en-US.

La mira circular física de K-09 comparte anclajes y eje ADS con la cuadrada. La retícula de pantalla conserva sus diseños y agrega cuadrada. La escopeta tiene un cuadro de esquinas más amplio, que representa su dispersión cuando es dinámica; no se añadió mira física a S-07.

## Cajas, botín y consumibles

Interacción proyectada cada cuadro a 3 m, mismo piso y sin pared intermedia. Mantener un segundo completa un anillo horario. Apertura inmediata, sin interpolación de tapa. Ocho cajas existentes y un pool fijo de 32 entradas de botín, cuatro tipos: K-09, S-07, vendaje y mini. Cantidades de munición conservan las probabilidades de V3; las cajas alternan paquetes de tres vendajes o tres minis, garantizando disponibilidad de ambos en el mapa.

Los objetos usan planos orientados a cámara en cada cuadro, con cuatro imágenes procedurales de 96×96 y dibujo sombreado para sugerir volumen. Recogida a 1.6 m, pausa visual inicial de 0.35 s y recorrido hacia el jugador de 0.32 s. Reservas reales: 360/56; sobrantes quedan disponibles. A tope se avisa sin recoger. Al regenerar la caja se renueva su botín sin acumular objetos. Los consumibles se limitan a nueve por tipo.

Vendaje: +25 de vida tras 3.5 s; mini: +25 de escudo tras 2 s, ambos hasta 100. Cada uso necesita una pulsación nueva, no pueden superponerse y no gastan al máximo. La barra de progreso y viñeta verde/azul responden al reloj de simulación, con salida de 0.45 s. No hay animación de manos. Moverse sigue permitido; disparar, recargar, cambiar de arma o morir cancela sin gastar. La pausa/editor también pausa estos tiempos.

## Información y aspecto

- Viñeta roja interior transparente en el centro: cada impacto renueva un segundo; con menos de 50 de vida late a 0.4 Hz, y con 15 o menos a 0.85 Hz con más intensidad.
- Tocar el indicador de balas inicia recarga; tocar AUTO RECARGA cambia únicamente ese interruptor.
- Lista de hasta cuatro bajas, dos segundos visibles más 0.25 de salida, filas descartables al tocarlas. Nombres azules/rojos. Baraja de 16 frases evita repetición hasta agotar las elegibles; «apuñaló» y «escopeteó» solo aparecen con el arma correspondiente. Las cinco añadidas son «sacó de circulación a», «dejó fuera de combate a», «apagó el radar de», «ganó el duelo contra» y «cerró la partida de». La variedad depende de cuántas bajas y armas haya: no se garantiza ver el 70% en una partida breve.
- Flechas blancas de compañeros sobre sus cabezas, visibles a través de paredes, escala según distancia y proyección cada cuadro. No muestran enemigos ni se usan en todos contra todos.
- Radar: conserva la posición del último disparo, no la posición oculta actual. Dado que el pedido mencionaba 2.5 y 3.2 s de forma incompatible, se eligió presencia plena hasta 1.8 s y desvanecimiento hasta 3.2 s. Otro disparo renueva gradualmente el indicador. Se registra el mismo evento para todos los actores; la IA sigue usando su audición limitada, no recibe visión a través de paredes por el radar.
- Sol con disco de radio 1.65 (antes 0.95) y halo 24 (antes 17). El disco se compone por encima del halo. Mismos materiales simples, textura de halo 64×64, sin luces adicionales, sombras nuevas ni postprocesamiento.

Autodisparo, consumibles y lista de bajas son elementos del editor HUD. Se mantienen perfiles separados, guardado/cancelación/restauración y bloqueo de juego durante la edición. Caja, flechas y botín siguen la cámara por cuadro, independientemente de la frecuencia menor de los números del HUD.

## Optimización y mediciones reales

Sin nuevas dependencias. Cuatro lotes instanciados para botín, pool de 20 flechas y cuatro filas de bajas. Sin creación de nodos DOM por cuadro. Los soldados conservan los dos lotes instanciados de V3. Se preservan colisiones, frecuencia física, resolución adaptable y audio espacial con límite de voces. La cache offline incluye los cinco módulos nuevos.

Comparación de CPU en Node, en el mismo entorno, 20 segundos simulados por escenario con 3 de calentamiento. Física/IA a 120 Hz y animación a 60 Hz; la columna de simulación mide dos pasos por cuadro nominal. En la actualización se abrieron las ocho cajas para incluir botín activo y se evaluó asistencia. **No incluye GPU, DOM ni audio y no mide FPS de un dispositivo.** Una sola ejecución por caso, con ruido de temporización: las pequeñas bajadas no se presentan como mejoras de rendimiento.

| Bots | Simulación anterior ms | Simulación nueva ms | Animación anterior ms | Animación nueva ms |
|---:|---:|---:|---:|---:|
| 1 | 0.030 | 0.030 | 0.031 | 0.032 |
| 4 | 0.141 | 0.091 | 0.093 | 0.085 |
| 8 | 0.165 | 0.194 | 0.142 | 0.158 |
| 12 | 0.282 | 0.265 | 0.201 | 0.205 |
| 16 | 0.281 | 0.325 | 0.237 | 0.269 |
| 20 | 0.329 | 0.371 | 0.293 | 0.309 |

Con 20 bots, estas dos tareas CPU sumaron 0.622 ms antes y 0.679 ms después: diferencia de unos 0.057 ms en este entorno, no una estimación de coste gráfico ni de Safari. El minimapa base en Chrome promedió 0.008 ms para 200 actualizaciones; no incluye el coste global de la interfaz. La lectura aproximada de heap JavaScript al terminar la prueba HUD fue 20.35 MB; no representa toda la memoria del juego ni demuestra ausencia absoluta de fugas.

## Verificaciones ejecutadas

- **24/24 física**: movimiento, rampas, escalones, colisiones, slide, slide jump, coyote/buffer y pasos temporales.
- **48/48 V3**: armas, navegación, percepción, equipos, daño, bots, reapariciones, modelos y sistemas conservados. Incluye simulación de 20 bots durante 90 s con 3 225 comprobaciones de penetración y cero violaciones. El caso de caja se adaptó al nuevo contrato de mantener/abrir/recoger.
- **33/33 nuevas**: ayuda real, límites/oclusiones/autodisparo, botín parcial y máximo, consumibles/timers, frases, radar, viñetas, eje de mira y lotes visuales.
- Estos **105 casos pasaron en Node y en Chrome**; se cuentan una sola vez.
- **54/54 HUD en Chrome**: DOM y Canvas 2D reales, eventos táctiles sintéticos, perfiles CSS 844×390 y 390×844, controles sin capas que los tapen, editor y persistencia. La integración ejecutó el ciclo real con reloj de diagnóstico controlado: ADS eliminó a un enemigo con un cartucho y no gastó otro después.
- **5/5 offline en Node VM**: precarga de 27 recursos, navegación y módulo desde caché sin red, limpieza limitada al ámbito del juego y no interceptar otros orígenes. Es validación del código del worker con Cache/Fetch simulados, no del ciclo Service Worker de Safari.

Total: **164 verificaciones distintas aprobadas**. Resultados y mediciones detalladas en `PRUEBAS.json`. `tests.html` y el diagnóstico HUD permiten repetir los casos de lógica e interfaz.

## Alcance de validación y límites

El navegador de pruebas no dispuso de WebGL. Se probaron geometría, rayos, matrices y proyecciones, pero no se presenta el diagnóstico sin 3D como una partida renderizada. No se midieron FPS gráficos, coste GPU ni comodidad táctil en iPhone. La revisión visual final del tamaño del sol, las miras y el botín, y la fluidez real de Safari quedan como validación de uso; no se promete coste cero ni 60 FPS. No se intentó acceder a un iPhone físico.

La inteligencia y animación de los bots siguen siendo la aproximación procedural de la V3; esta entrega no las reconstruye. El inventario es simple, se reinicia al reaparecer y no incorpora arrastrar/soltar objetos ni un sistema complejo de equipo. El botín sin recoger se renueva con su caja. No se añadieron servicios de pago, backend ni multijugador.

## Archivos

Añadidos: `aim-support.js`, `combat-feedback.js`, `combat-ui.js`, `loot-visuals.js`, `supplies.js`, `verify-combat-ui.js`, `verify-combat.js`.

Modificados frente a la V3 entregada: `INFORME.md`, `PRUEBAS.json`, `README.md`, `audio.js`, `combat.js`, `game.js`, `hud.js`, `index.html`, `input.js`, `match.js`, `preferences.js`, `settings-v2.js`, `style.css`, `sw.js`, `tests.html`, `verify-v3.js`, `weapon-models.js`, `world-v3.js`.

La entrega contiene 39 archivos sueltos, incluidos código, dependencia local y licencia, instrucciones y verificaciones. No necesita carpetas, rutas de desarrollo ni compilación.
