# Fase Estudiar — límite diario + modo Práctica

Afinar la sección Estudiar: un solo FSRS por ficha, prompt de "cuántas nuevas hoy",
y un modo Práctica por categoría separado del repaso del día.

> Rama `fase-estudiar` desde `main`. No toca el esquema de forma destructiva
> (a lo más, un campo de settings). Build limpio antes de empezar.

---

## 1. Principio rector (no romper)

**Una ficha = un solo estado FSRS = un solo calendario.** Nada de calendarios paralelos por
categoría: la memoria de una posición es una sola. Los "modos" son formas de mirar/seleccionar
las mismas fichas, no agendas distintas.

## 2. Repaso del día (Estudiar · "Todas")

- Muestra lo que **vence hoy** según FSRS, **intercalado** (mezcla apertura/medio/táctica/finales
  y sus temas). Este es el estudio oficial y SÍ mueve el calendario.
- **Quitar los chips de filtro por tema** que existen hoy en Estudiar (despejan la pantalla; el
  filtrado fino ya no se usa aquí). El repaso del día es una sola cola intercalada.

## 3. Prompt "¿Cuántas nuevas hoy?"

- Al entrar a Estudiar (primera vez del día), preguntar cuántas tarjetas **nuevas** introducir hoy.
- Presets: **10 / 15 / 20** + opción "Otra cantidad". Default recordado = 10 (configurable).
- Controla SOLO las nuevas. Los **repasos vencidos siempre se muestran completos** (saltarlos
  rompería el espaciado). Si hoy vencen 25 repasos, tocan los 25 + las nuevas elegidas.
- Guardar la preferencia de default en settings (un store/registro simple, p.ej. `settings`
  key-value, o un campo en un store existente). Aditivo, sin migración destructiva.

## 4. Modo Práctica (separado y bien etiquetado)

- Un modo aparte dentro de Estudiar, **claramente distinto** del repaso del día
  (etiqueta visible tipo "Práctica · no cuenta para hoy").
- Entras por **categoría de primer nivel**: Aperturas | Medio juego | Táctica | Finales.
- Repasas **todas** las fichas de esa categoría (y su subárbol), **toquen o no hoy**.
- **NO toca el FSRS**: no registra reviews, no reprograma, no consume el cupo de nuevas.
  Es práctica libre (misma idea que Entrenar, pero por categoría dentro de Estudiar).
- Reusa el componente de tarjeta/StudyPlayer existente en modo "solo práctica" (sin botones
  de calificación FSRS, o con calificación deshabilitada que no persiste).

## 5. UI / claridad (importante)

- El usuario nunca debe confundir "repaso de hoy" con "práctica". Separación visual clara:
  repaso del día con su contador (p.ej. 1/15) y la práctica con su etiqueta de "no cuenta".
- Al terminar el repaso del día, mensaje claro de "terminaste por hoy" (independiente de la práctica).

## 6. Listo cuando
- [ ] `pnpm --filter web build` limpio; datos intactos.
- [ ] Al entrar a Estudiar te pregunta cuántas nuevas hoy (10/15/20/otra), con default recordado.
- [ ] El repaso del día = lo que vence hoy, intercalado, sin chips de filtro por tema.
- [ ] Modo Práctica por categoría muestra todas sus fichas (toquen o no) y NO mueve el FSRS.
- [ ] Repaso del día y Práctica se distinguen claramente en la UI.
- [ ] El límite de nuevas se respeta; los repasos vencidos siempre se muestran completos.

## 7. Decisiones cerradas
1. Un solo FSRS por ficha, un calendario. Sin calendarios por categoría.
2. Repaso del día = "Todas" intercalado, sin filtros por tema (se quitan los chips).
3. Prompt al entrar: "¿Cuántas nuevas hoy?" presets 10/15/20 + otra, default 10 configurable.
4. Modo Práctica por categoría de primer nivel, no toca FSRS, bien etiquetado y separado.
