# Propuestas de Erratas para el Informe / Documentación Académica (RUMA — Grupo 6, IFTS N.º 12)

> **Estado de este documento:** Propuestas redactadas para revisión y aprobación del Grupo 6 antes de modificar cualquier informe académico previo. No sustituyen decisiones del equipo sin confirmación expresa.

---

## 1. Corrección de ejemplo geográfico en CABA (Caballito → Retiro)
- **Detectado en documentación previa:** Referencia a viajar entre Caballito y Retiro utilizando el *Tren Sarmiento*.
- **Errata propuesta:** El Ferrocarril Sarmiento une **Once (Plaza Miserere)** con el oeste del Gran Buenos Aires (Moreno) y **no llega a Retiro**. Para el corredor real Caballito → Retiro en transporte público de CABA corresponde indicar combinaciones reales como **Subte Línea A (Acoyte / Primera Junta) + combinación en Lima/Av. de Mayo hacia Línea C (Retiro)**, o líneas de colectivo / combinaciones vía Línea B según el punto exacto de Caballito.

## 2. Estado de Machine Learning, EDA y métricas citadas
- **Detectado en documentación previa:** Mención de porcentajes específicos (`88%`, `89,2%`, `87,4%`, `86,2%`, `88,1%`, `62%/28%` de causas de incidencias, `~18%` de elevadores detenidos) y afirmaciones de algoritmo `A*` o modelos predictivos entrenados.
- **Errata propuesta:** Consignar explícitamente que el componente de **ML y EDA es experimental / conceptual**. Ninguna métrica numérica debe presentarse como resultado verificado mientras no exista dataset fuente, código reproducible y registro de ejecución auditado. En el prototipo actual el ruteo real se resuelve con **Google Maps Platform (Routes API v2)** y el filtrado/ordenamiento se implementa con **reglas determinísticas + normalización min-max**.

## 3. Promesas funcionales y verificabilidad de accesibilidad en vivo
- **Detectado en documentación previa:** Formulaciones que sugieren garantía de "rutas 100% accesibles", "estado de ascensores en tiempo real" o seguimiento paso a paso tipo GPS.
- **Errata propuesta:**
  - Aclarar que el endpoint `apitransporte.buenosaires.gob.ar` devuelve `401` sin credenciales privadas y que `emova.com.ar/accesibilidad/` no provee una API JSON abierta sin autenticación.
  - En consecuencia, RUMA informa honestamente **`"Accesibilidad operativa no verificada"`** cuando falta confirmación en vivo y deriva a los canales oficiales (`Emova Accesibilidad`, `BA Cómo Llego`, `Trenes Argentinos`).
  - Explicitar que el prototipo **no** realiza navegación GPS giro a giro ni garantiza puntualidad exacta.

## 4. Marca visible y reparto de roles A/B/C
- **Detectado en documentos recientes:** Propuesta de nombre `"RutaActiva"` y asignaciones en parejas A/B/C.
- **Errata propuesta:** Mantener **RUMA — Rutas para una Movilidad Urbana Adaptativa** como nombre técnico, de trabajo y visible por defecto hasta que el grupo vote formalmente un eventual cambio (centralizado en `src/shared/branding.ts`). Dejar asentado que los **roles A/B/C y la asignación de módulos permanecen pendientes de validación por el grupo**, conservando la nómina confirmada de seis integrantes (`Ballesteros, Martín; Coppa, Ariel; Díaz Musso, Ianina; Domínguez, Elizabeth; Presti, Gisele; Robles Gianotti, Agustina`).

## 5. Alcance de los 50 casos sintéticos RUMA
- **Errata propuesta:** Documentar que los **50 casos sintéticos RUMA (150 alternativas)** son exclusivamente una **batería de pruebas de QA/regresión** para verificar restricciones y escenarios extremos, nunca una fuente de itinerarios en modo real ni material de entrenamiento del modelo generativo.
