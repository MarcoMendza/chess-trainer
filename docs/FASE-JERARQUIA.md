# Fase Jerarquía — temas anidados (tags con padre)

Dar a los tags una jerarquía (padre/hijo) para organizar el estudio por apertura/familia,
manteniendo los tags planos transversales que ya existen.

> Rama `fase-jerarquia` desde `main`. Toca el modelo de datos (migración Dexie). Merge a `main` al probar.
> Primer paso del agente: `pnpm --filter web build` limpio ANTES de tocar nada.

---

## 1. Objetivo

Organizar temas como árbol: Apertura › Colle › Zukertort › c4, o Final › TvT › Lucena.
Entrar a un nodo ("Colle") junta todas las tarjetas de su subárbol para estudiar/entrenar.

## 2. Dos ejes que NO se mezclan

- **Jerarquía (dónde vive la línea):** un tag tiene UN padre. Árbol limpio. Esta fase.
- **Transversal (qué concepto toca):** los tags planos que YA existen, múltiples por tarjeta
  (clavada, estructura Maroczy, etc.). NO se tocan. Cubren lo que un grafo cubriría
  (una posición que aparece en dos familias se etiqueta con un tag plano además de su lugar en el árbol).

## 3. Reglas de la jerarquía

- **Un solo padre** por tag (no grafo). La raíz de cada árbol es la categoría existente
  (finales | estructura | tactica | apertura | medio).
- **Anidación libre con tope de 4 niveles** (ej. Apertura › Colle › Zukertort › c4). No patrón rígido.
- **Un nodo puede tener tarjetas propias Y además hijos.** Ej.: "Colle" tiene su ficha del Colle puro
  (línea principal) y además hijos Zukertort/c4. No obligar a crear subniveles artificiales.
- Casos cortos válidos: Apertura › Iniciativa (2 niveles), Apertura › Rey en el centro.

## 4. Modelo de datos (migración Dexie v3, aditiva)

- Agregar `parent_id TEXT NULL REFERENCES tags(id)` a la tabla/store `tags`.
  - `null` = nodo raíz (cuelga directo de su categoría).
- Migración **aditiva**: bump de versión Dexie que solo añade el índice/campo; NO recrear stores,
  NO perder datos. Tags existentes quedan con `parent_id = null` (raíz) por defecto.
- Validar al asignar padre: no permitir ciclos (un tag no puede ser su propio ancestro) ni superar
  4 niveles de profundidad.
- Reflejar el cambio en `docs/FASE-0-DISENO.md`.

## 5. Recolección de tarjetas (subárbol)

- Helper `descendantTagIds(tagId)` → el tag + todos sus descendientes.
- Estudiar/Entrenar/filtros por un nodo padre usan ESE conjunto: junta todo el subárbol.
- Conteos por nodo = tarjetas del subárbol completo (no solo las pegadas directo al nodo).

## 6. UI

- **Gestionar temas:** árbol plegable (expandir/colapsar). Crear/editar un tag incluye un
  **selector de "tema padre"** (lista de tags candidatos válidos, respetando tope y sin ciclos).
  Sin drag-and-drop en v1 (en móvil es incómodo).
- **Entrenar:** la lista de temas se vuelve árbol plegable por categoría → familia → línea.
  Tocar un nodo entra a su subárbol (reusa lo de la fase de tags).
- **Estudiar:** los chips de filtro por tema respetan la jerarquía (elegir "Colle" trae su subárbol).
- **Borrar un nodo con hijos:** preguntar qué hacer (subir los hijos al abuelo, o borrar el subárbol).
  Default seguro: subir los hijos un nivel, no borrarlos en cascada sin avisar.

## 7. Listo cuando
- [ ] `pnpm --filter web build` limpio antes y después; datos existentes intactos tras migración.
- [ ] Creas Apertura › Colle › Zukertort › c4 y también Final › TvT › Lucena.
- [ ] "Colle" tiene ficha propia (Colle puro) y además hijos; ambos conviven.
- [ ] En Estudiar/Entrenar, elegir "Colle" junta todas las tarjetas del subárbol.
- [ ] Gestionar temas muestra el árbol plegable y el selector de padre funciona (sin ciclos, tope 4).
- [ ] Los tags planos transversales siguen funcionando igual que antes.

## 8. Decisiones cerradas
1. Profundidad: anidación libre, tope 4; un nodo puede tener tarjetas propias y hijos.
2. Un solo padre (árbol, no grafo). Lo transversal → tags planos existentes.
3. Estudiar/Entrenar juntan todo el subárbol del nodo elegido.
4. Selector de padre (sin drag-and-drop) en v1.
