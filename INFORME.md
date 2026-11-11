# NODO 09 · Informe V3

Entrega: 11 de noviembre de 2026. Proyecto estático completo, sin multijugador ni servicios externos.

## Base conservada

Se partió de la V2 real de https://github.com/IzayTO/KINEtiK, commit `dcb6488e4c3e0cb6d42fa08e0cbbf77cbea207c2`. Los 26 archivos de esa base se contrastaron con los hashes Git del repositorio antes de modificarla. No se publicó ni se modificó el repositorio remoto.

`physics.js`, `level.js`, `render.js`, `refinements.js` e `input.js` conservan sus bytes. No hubo cambios inevitables en el controlador: caminar 4.2 m/s, carrera 7.4, sprint 11.5, aceleración 46 m/s², fricción 8 s⁻¹, salto 8.6 m/s, gravedad 24 m/s², slide +2.6 m/s, duración 1.25 s, desaceleración 4.2 m/s², control aéreo 0.34 y FOV horizontal inicial 100°. Los ajustes personalizados previos siguen cargándose. Se compararon **12 000 pasos** de posiciones, velocidades, alturas y estados, con disparos/cambios de arma en paralelo: igualdad exacta frente a V2.

Las seis zonas, pasarelas, rampas, escaleras, interiores, paleta y los 139 sólidos originales permanecen. La ubicación inicial ahora usa puntos de aparición seguros según equipo, lo que no cambia la física.

## Bots y navegación

`match.js` coordina combate, percepción, decisiones, munición, supervivencia y partidas. `navigation.js` deriva un grafo de varias alturas de los sólidos originales y ejecuta A*. Los recorridos usan el mismo `Player` cinemático del usuario: no se mueven atravesando geometría mediante animación. Hay anticipación de esquinas, aceleración de giro, separación local entre bots, detección de falta de progreso y cambio de ruta sin teletransportes durante navegación. Un enlace explícito permite el salto de terraza alta a plataforma inferior; rampas y escaleras usan conexiones caminables.

Cinco perfiles —**Agresivo, Táctico, Ágil, Defensivo y Equilibrado**— modifican distancia deseada, avance, flanqueo, retirada, selección de altura y movilidad. Variaciones individuales de reacción, ruta y puntería permanecen estables durante la partida. Fácil, Normal y Difícil cambian reacción, error, velocidad angular y probabilidad táctica; ninguno obtiene visión a través de paredes.

Visión limitada a unos 128° horizontales y 52 m, reconocimiento gradual, oclusión por sólidos y memoria visual de 5.5 s. La audición deja una zona aproximada durante 3.5 s; no adquiere automáticamente un enemigo. Los aliados próximos pueden compartir una última zona conocida. Las decisiones alternan exploración, investigación, presión, flanqueo, cobertura, retirada, posición elevada y reabastecimiento.

Los bots apuntan gradualmente, limitan el giro del torso, disparan en ráfagas y aplican error según dificultad/movimiento. El rayo utiliza la orientación del arma; además se comprueba que su boca no haya pasado al otro lado de un muro. La geometría bloquea antes de aplicar daño. Pueden disparar desplazándose, retroceder, recargar, cambiar de arma y usar cuchillo. Los deslizamientos se vinculan a coberturas, flancos y pasos bajos; el perfil ágil puede enlazar slide jump.

## Soldado Concepto 1 y animación

Se construyó un único modelo procedural low-poly basado en la referencia: casco biselado, visor menta, traje gris verdoso, pechera y antebrazos claros, cinturón/bolsillos, botas angulares y detalles naranja. Solo los parches identificativos cambian a azul o rojo.

Jerarquía de pelvis, abdomen, pecho, cuello, cabeza, hombros, codos, muñecas, manos, caderas, rodillas, tobillos y pies. Cada soldado usa 59 piezas, con dos geometrías compartidas. **Todos los soldados se dibujan mediante dos mallas instanciadas**, no una llamada por articulación. Los nodos articulares se calculan fuera del grafo de escena.

Respiración, paso, carrera, sprint, avance lateral/retroceso, giro de torso separado, postura aérea, aterrizaje, agachado, slide, levantarse, apuntado, retroceso, recarga, cambio, tres cortes, reacción a impactos, caída de eliminación y reaparición. Los brazos utilizan IK de dos segmentos y las manos siguen el arma; las piernas usan ciclos según velocidad y dirección reales. Se revisaron proyecciones CPU del modelo y la altura de las posturas bajas.

## Partidas y supervivencia

Entrenamiento sin final por tiempo; todos contra todos por puntuación individual; Team Deathmatch rojo/azul por puntuación de equipo. Configuración de 1–20 bots, dificultad, equipo, duración, límite, calidad de IA e intervalo de cajas. Inicio, reinicio, regreso al menú y tabla final funcionan sobre el estado real de partida.

Jugador y bots tienen 100 de vida y 100 de escudo. El escudo absorbe primero; el sobrante pasa a vida. Sin regeneración automática añadida. Eliminación, puntuación y reaparición a los 3.2 s con 2.2 s de protección; atacar termina esa protección. Se puntúan posiciones de reaparición por espacio válido, distancia y exposición a enemigos. El daño aliado está desactivado.

Ocho cajas en recorridos y emplazamientos seleccionados entregan cantidades limitadas de rifle, escopeta o ambas. No se gastan si el personaje ya está abastecido. Tapa animada, estado vacío y regeneración configurable; también las usan bots con necesidad de munición. Son activadores de recogida y no añaden obstáculos a las rutas originales.

## Armas e interfaz

- **K-09:** rifle largo, 40 + 360 cartuchos reales. Auto/semi, recarga parcial que descuenta la reserva, auto recarga ON/OFF dentro del indicador. La recarga y sus desplazamientos de mano/cargador continúan durante sprint; se limpian offsets al cambiar de arma.
- **S-07:** siete cartuchos, reserva 56, nueve perdigones y caída de daño por distancia. Modo corredera 0.82 s y táctico 0.48 s, con bombeo y sonidos adaptados. Inserción individual interrumpible. Sin geometría de mira superior.
- **FILO:** hoja volumétrica de sección romboidal, barrida hacia atrás y al lateral exterior del antebrazo. Tres ataques alternados. Alcance horizontal circular **2.7 m inclusive**, diferencia vertical máxima 0.95 m, línea despejada, un solo objetivo por ataque y eliminación de un golpe. No aumenta la velocidad del jugador.
- **HUD:** barra del editor plegable sin perder selección; capas táctiles corregidas para las tres ranuras en ambas orientaciones; círculo fino configurable; vida, escudo, puntuación y estado de partida editables por separado. Se mantienen retículas, minimapa, sensibilidades, asistencia y perfiles guardados V2.
- **Marcador:** proyección de etiqueta en cada cuadro; cifras de distancia y resto del HUD a frecuencia menor. Un único elemento DOM reutilizado.
- **Cielo:** azul con degradado por colores de vértice, sol pequeño y resplandor de 64 × 64; sin sombras ni luz dinámica nuevas. Se conserva la iluminación original y se ajusta el color de niebla al horizonte.

## Audio

Síntesis original con Web Audio: pasos/carrera/sprint, salto, aterrizaje, slide, frenada, rifle, escopeta, bombeo, recarga, cartucho, cambio, cuchillo, impacto, escudo/vida, eliminación, aparición, caja/recogida, ping y cargador vacío. Volúmenes independientes y ambiente discreto. Sonidos ajenos con paneo estéreo, atenuación por distancia, límite de alcance y máximo de 14 voces con prioridad. No hay archivos de audio externos ni licencias adicionales.

## Pruebas ejecutadas

**24/24** del controlador original, **48/48** nuevas de V3 y **28/28** de HUD: 100 comprobaciones distintas. Las 72 primeras se ejecutaron en Node y también en Chrome, sin contar la repetición como pruebas nuevas. El HUD utilizó elementos DOM y Canvas 2D reales con eventos sintéticos, incluidos varios identificadores de puntero y marcos CSS 844 × 390 / 390 × 844. No se trata de dispositivos emulados.

Se verificaron cargadores/reservas finitos, cadencia, auto recarga, alimentación de escopeta, cuchillo a 1/2/2.5/2.7/2.8/3 m y diagonal, muros/pisos, escudo/vida, aliados, reacción/visión/memoria/audición, cajas, puntuaciones, reaparición, giro en marcha y rutas reales hasta las cubiertas a 3.2 y 6.4 m. Una sesión de 90 segundos simulados con 20 bots en Node produjo 3 225 muestras de posición sin penetraciones de sólidos, 1 364 disparos, 9 saltos y 56 slides; aparecieron ocho estados de comportamiento y posiciones en pasarelas a 3.2 m. La repetición en Chrome también pasó, con las cifras propias incluidas en JSON.

Además: regresión específica de cambio de arma durante recarga, cinco comprobaciones del código de caché offline con Cache/Fetch simulados en Node, sintaxis de los módulos, dependencias locales e integridad del ZIP. El caché no se da por validado en Safari por estos tests.

### Mediciones de CPU, no FPS gráficos

35 segundos simulados por cantidad de bots; 5 de calentamiento y 30 medidos. Cada cuadro medido incluye dos pasos físicos de 1/120 s y una actualización de animación a 1/60 s. Node en contenedor, sin GPU, DOM ni audio dentro de este benchmark. Las cifras dependen del equipo y de la carga; **no predicen el rendimiento del iPhone**.

| Bots | Física + IA, media ms | Animación, media ms | CPU combinada, P95 ms | Triángulos asignados* |
|---:|---:|---:|---:|---:|
| 1 | 0.022 | 0.029 | 0.120 | 7,888 |
| 4 | 0.060 | 0.063 | 0.264 | 12,652 |
| 8 | 0.150 | 0.151 | 0.588 | 19,004 |
| 12 | 0.220 | 0.177 | 0.726 | 25,356 |
| 16 | 0.258 | 0.223 | 0.874 | 31,708 |
| 20 | 0.313 | 0.285 | 0.941 | 38,060 |

*Incluye armas inactivas y efectos reservados. No es el número de triángulos visibles de un cuadro GPU.*

La actualización visual CPU de V2, en su prueba sin bots, promedió 0.0142 ms. La escena base describe 5 946 triángulos y 68 mallas; V3 mantiene 69 mallas en el grafo para cualquiera de las cantidades probadas, con instancias adicionales dentro de ellas. Los lotes visibles **no son draw calls medidos**. Con 20 bots hay 1 700 nodos de articulación fuera de escena. Las geometrías y matrices de instancias suman aproximadamente 243.1 KiB de buffers CPU; no es memoria total ni memoria GPU.

El minimapa promedió 0.006 ms en 200 actualizaciones de Canvas 2D en Chrome. Su lectura de heap JS fue 11 863 979 bytes en esa sesión de diagnóstico; incluye la página y pruebas, excluye GPU y no constituye un límite del juego. El presupuesto de rutas es global (hasta 12 búsquedas/s); dirección a 20 Hz, percepción/decisiones escalonadas, física a 120 Hz y animación interpolada. Continúan el límite de densidad de píxeles y resolución adaptativa V2. Efectos en pools, minimapa limitado a 10 Hz, sin sombras dinámicas añadidas.

## Límites conocidos y validación pendiente

- El navegador de verificación no crea un contexto WebGL. Por eso **no se verificó una partida 3D renderizada**, ni FPS gráficos, tiempo GPU, draw calls reales o memoria gráfica. Se validaron lógica, colisiones, geometría/matrices y DOM. La vista normal del juego sigue siendo WebGL; el diagnóstico sin 3D está explícitamente separado.
- Revisión visual completa, sensación táctil y rendimiento sostenido en Safari/iPhone quedan para la prueba de uso del dispositivo. No se intentó emularlo ni se prometen 60 FPS con 20 bots.
- La IA es heurística: puede necesitar una nueva ruta en cruces concurridos. La separación entre soldados es local; no hay simulación de masas ni coordinación de escuadra compleja. No utiliza saltos arbitrarios entre cualquier techo: solo conexiones seguras y el enlace especial descrito.
- Hitboxes de cabeza/torso/extremidades aproximadas y animaciones procedurales, sin ragdoll ni IK de pies sobre cada escalón. No se afirma coincidencia exacta entre cada extremidad animada y su volumen de daño. Los dedos son simplificados; la eliminación usa caída animada.
- Audio implementado y conectado a eventos; calidad de escucha y percepción espacial en auriculares/altavoz quedan sin evaluación auditiva. El paneo es estéreo por dirección/distancia, sin HRTF ni reverberación acústica del edificio.
- El almacenamiento local y el caché offline dependen del navegador. No se guardan partidas en curso; sí ajustes, distribuciones y configuración. Para futuras ediciones incrementa VERSION en `sw.js` para renovar el paquete almacenado.

## Archivos

Modificados: `INFORME.md`, `PRUEBAS.json`, `README.md`, `audio.js`, `combat.js`, `game.js`, `hud.js`, `index.html`, `preferences.js`, `settings-v2.js`, `style.css`, `tests.html`, `verify-scene.js`, `weapon-models.js`, `world-v2.js`.

Nuevos: `match.js`, `navigation.js`, `soldier.js`, `sw.js`, `verify-hud-v3.js`, `verify-v3.js`, `world-v3.js`.

Conservados byte por byte: `THREE-LICENSE.txt`, `icon.svg`, `input.js`, `level.js`, `physics.js`, `refinements.js`, `render.js`, `three.module.min.js`, `verify-hud.js`, `verify.js`.

Retirados del paquete: `verify-v2.js (pruebas antiguas de 30 cartuchos; sustituidas por verify-v3.js)`.

Los nombres `world-v2.js` y `settings-v2.js` se conservan por compatibilidad interna; forman parte de esta única V3. Todos los archivos del ZIP quedan en la raíz y las dependencias son locales. Three.js mantiene su licencia MIT en `THREE-LICENSE.txt`.
