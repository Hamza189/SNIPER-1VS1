# Armas clásicas — Poly Haven (CC0)

> **Aún no están en el juego.** Se guardan para una fase posterior como **aspectos alternativos que se eligen**. Lo decidió el propietario el 17-10-2026 (opción 1).
> Las armas del juego siguen siendo HALCÓN R7, VÍBORA 9 y la navaja táctica.
> Un aspecto no cambia el daño, la balística, la cadencia, los tiempos ni da ninguna otra ventaja.

| Archivo | Modelo | Fuente | Autor | Partes | Triángulos | Tamaño |
|---|---|---|---|---|---|---|
| `bolt_action_rifle_7_62.glb` | Rifle de cerrojo de madera (tipo Mosin) con visor pequeño, 1,23 m | https://polyhaven.com/a/bolt_action_rifle_7_62 | Mateusz Sadek | cuerpo, cerrojo (2 piezas), bala, visor, gatillo, venda | 19 985 | 5,8 MB |
| `service_pistol.glb` | Pistola de acero (tipo P38); **dos variantes** (cachas de madera y cachas azules) | https://polyhaven.com/a/service_pistol | Mateusz Sadek | armazón, corredera, martillo, gatillo y cargador (vacío y lleno) de cada variante, y bala | 27 548 (las dos) | 1,7 MB |
| `fish_knife.glb` | Cuchillo de pesca con mango de madera | https://polyhaven.com/a/fish_knife | Mateusz Sadek | hoja, mango | 2 736 | 0,9 MB |

**Licencia:** CC0, como todo Poly Haven (https://polyhaven.com/license). Permite uso comercial y no exige atribución.

## Cómo se generan

1. `tools/weapons_classic/export_classic.py`, en Blender, aplica los modificadores, conserva cada pieza con su nombre y reduce las texturas de 4K a 1024.
2. `tools/weapons_classic/repack_glb.py` vuelve a codificar las imágenes. Blender las guarda como PNG de 16 bits, unos 5 MB cada mapa normal; así pasan a JPEG, y a PNG de 8 bits las que tienen transparencia. Con eso el total baja de 34 a 8,4 MB.

## Comprobado

- Las tres cargan en el Three.js r128 del juego con todas sus texturas.

## Pendiente para cuando se usen

- **Encuadre en primera persona:** colocarlas con las manos actuales, sobre el mismo punto de mira y con el visor calibrado.
- **Animaciones:** reutilizar las de las armas actuales (cerrojo, corredera, cargador), aprovechando las piezas separadas.
- **Hoja del cuchillo:** sale negra sin un mapa de reflejos (metal pulido sin entorno).
- **Pistola:** elegir una variante y quitar las piezas duplicadas.
- **Triángulos:** el rifle (20 000) y la pistola (unos 14 000 por variante) pesan más que las armas actuales, así que harán falta niveles de detalle para los rivales.
