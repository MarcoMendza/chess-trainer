# Fase Tags + Entrenar — estudio por tema

Etiquetar posiciones por tema, verlas por tema, y estudiar mezclando temas (interleaving).
Es el módulo que conecta con el plan real: sembrar Chess Enigma por concepto y que se arraigue.

> No toca el modelo de datos: `tags`, `position_tags`, `game_tags` y los campos `source_url`/
> `source_time` de `positions` ya existen en `docs/FASE-0-DISENO.md`. Esta fase los expone en la UI.

---

## 1. Objetivo

Estudiar por **idea/tema**, no por "mejor jugada". Que cada posición de un curso (Chess Enigma, etc.)
viva etiquetada por su concepto, con su idea en palabras y el link al video para reforzar.

## 2. Alcance v1

INCLUYE:
- CRUD de tags: nombre + categoría (finales | estructura | tactica | apertura | medio).
- Sembrar tarjeta: extender "Guardar como tarjeta" (desde Importar y Análisis) con:
  selector de tags + idea (texto) + eval_note + **link del video** (source_url) + **minuto** (source_time).
- Tab **"Entrenar"**: vista por tema. Lista de temas con su conteo; al entrar, ves las posiciones de
  ese tema y puedes repasarlas on-demand (sin SRS) — para machacar un tema que estás viendo esta semana.
- Estudiar por tema: en Estudiar poder acotar la sesión a un tag, además de "todas las pendientes".
- **Modo intercalado (interleaving)**: la sesión de "todas" mezcla temas a propósito (mejora reconocer
  QUÉ concepto aplica). "Por tema" es el modo bloque, para cuando quieres machacar uno solo.
- Filtro por tag en Torneos (ver partidas etiquetadas con un tema).

NO incluye (después):
- Importar material en lote / parsear cursos automáticamente (Fase opcional).
- Dashboard de retención por tema (siguiente).
- Tarjeta best_move (descartada por ahora: estudiamos por idea, no por mejor jugada del motor).

## 3. Sub-pasos (orden de construcción)

1. Capa de tags: CRUD + autocomplete al escribir (reusa tags existentes, no duplica).
2. Form de "Guardar como tarjeta" extendido: tags + idea + eval_note + source_url + source_time.
   Este es el flujo central de sembrado; cuidarlo en móvil (rápido de llenar con el dedo).
3. Tab "Entrenar": lista de temas (con conteo) → detalle del tema con sus posiciones → repaso on-demand.
4. Estudiar acotado por tag + selector de modo (todas/intercalado vs por tema/bloque).
5. Filtro por tag en Torneos.

## 4. Detalles que importan

- **Tags libres con categoría**: escribes el nombre (con autocomplete) y le asignas categoría. No lista
  cerrada (no encajonar), pero la categoría mantiene orden. Ej: "Clavada"/tactica, "Profilaxis"/estrategia
  (medio), "Peones doblados"/estructura, "f2-f7"/tactica.
- **El link de video es de primera clase**, no un extra: al fallar/repasar, un toque te lleva a
  `source_url` + `source_time` para re-ver ESE momento del curso. Es la preferencia de estudio por video.
- **Interleaving = default** de la sesión "todas". El bloque por-tema es la excepción, no al revés.
- Una posición puede tener varios tags (es M:N por `position_tags`). Respetar eso en filtros y conteos.

## 5. Listo cuando

- [ ] Creas tags por categoría y los reusas con autocomplete.
- [ ] Guardas una posición de un curso con tags + idea + link de video + minuto, y queda en su tema.
- [ ] En "Entrenar" entras a un tema y ves/repasas sus posiciones.
- [ ] En "Estudiar" puedes acotar a un tema o estudiar todas en modo intercalado.
- [ ] En una tarjeta, un toque te abre el video en el minuto guardado.

## 6. Decisiones (defaults; cambiar si Marco quiere otra cosa)

1. Entrenar v1 = **posiciones por tema** (las partidas por tag se ven con el filtro en Torneos).
2. Tags = **libres + categoría** con autocomplete (no lista cerrada).
3. Interleaving = **default** en "estudiar todas"; "por tema" = modo bloque.
