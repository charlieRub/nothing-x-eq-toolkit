# Instrucciones para generar perfiles Nothing X importables

Estas reglas son obligatorias para evitar el error `Codigo QR valido no encontrado` en Nothing X.

## 1. Mantener siempre las 8 bandas en su zona

Nothing X permite mover frecuencia, Q y ganancia, pero el QR parece validar que cada una de las 8 bandas siga dentro de su rango original. No intercambiar bandas ni poner una frecuencia fuera de su zona.

| Banda | Rango valido | Zona segura recomendada |
| --- | --- | --- |
| 1 | 20-100 Hz | 45-70 Hz |
| 2 | 100-200 Hz | 115-160 Hz |
| 3 | 200-400 Hz | 260-330 Hz |
| 4 | 400 Hz-1 kHz | 600-800 Hz |
| 5 | 1-3 kHz | 1.8-2.6 kHz |
| 6 | 3-6 kHz | 4.0-5.2 kHz |
| 7 | 6-12 kHz | 8.0-10 kHz |
| 8 | 12-20 kHz | 14.5-16 kHz |

Ejemplo de error: usar 2.8 kHz en la banda 6 o 8.5 kHz en la banda 8 puede generar un QR que se lee tecnicamente, pero Nothing X lo rechaza.

## 2. Orden binario del payload

El payload que ha funcionado en Nothing X tiene esta estructura:

```text
00 60
8 bandas, cada una con:
  ganancia float32 little-endian
  frecuencia float32 little-endian
  Q float32 little-endian
01
longitud del nombre en bytes
nombre UTF-8
```

Despues se comprime con gzip y se codifica en Base64. Ese texto Base64 es lo que se mete en el QR.

## 3. Valores recomendados para compatibilidad

- Ganancia: preferible entre -3.0 dB y +4.5 dB.
- Evitar perfiles con todo muy bajo o todo muy alto.
- Q: preferible entre 0.8 y 2.2.
- Para perfiles de musica general, no usar Q extremos.
- Nombres cortos, ASCII o texto simple: `Pop Vocal`, `Video Voz`, `Piano Natural`.
- Evitar simbolos raros, barras, emojis o nombres muy largos.

## 4. QR fisico/imagen

- Usar QR limpio en negro sobre blanco.
- Margen grande: minimo 4 modulos; mejor 8.
- No poner logo ni decoracion encima del QR para importar.
- Error correction `M` o `H`; si el QR queda muy denso, usar `M` con margen grande.
- Mostrar la imagen en grande y con brillo alto al escanear.

## 5. Regla practica para nuevos perfiles

Primero elegir el objetivo sonoro, pero despues adaptar siempre a estas 8 bandas:

```text
grave/subgrave:       banda 1, 45-70 Hz
golpe/cuerpo bajo:    banda 2, 115-160 Hz
barro/caja baja:      banda 3, 260-330 Hz
nasalidad/cuerpo voz: banda 4, 600-800 Hz
claridad voz:         banda 5, 1.8-2.6 kHz
presencia/ataque:     banda 6, 4.0-5.2 kHz
brillo:               banda 7, 8.0-10 kHz
aire:                 banda 8, 14.5-16 kHz
```

Si un ajuste teorico cae fuera de su banda, no se pone ahi: se traslada a la banda valida mas cercana.

