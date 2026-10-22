# Desempeño & Métricos — Grupo PDC

Plataforma de evaluaciones de desempeño (EDD), métricos y comisiones. Secciones: **Resumen**, **Evaluación EDD**, **Métricos y comisión**, **Gestores**, **Historial mensual**, y herramientas (Planes del mes, Exportar Excel, WhatsApp, Importar, Configuración).

Plataforma web para el equipo de **Cobros Venta Directa**. Reemplaza el trabajo manual en varios Excel:

- **Padrón** editable de gestores: código, nombre, rol, equipo, supervisor, estado, fecha de ingreso, teléfono de WhatsApp y base de comisión. Desactivar no borra historial.
- **Equipos** editables (Team Chévere, Team Imparables y los demás), con supervisor y bandera "recibe comisión".
- **Planes del mes**: plan común por equipo (EDD y métricos) que se aplica a sus integrantes, con **excepciones individuales**.
- **Evaluación EDD** por gestor y mes con el formato original (plan de trabajo, semáforo Cumple / No cumple, resultado final que decide el supervisor, comentarios, autorización y cierre). Versión **inicial** y **final**.
- **Métricos y comisión** en quetzales: `pago del métrico = base × ponderación × % de cumplimiento`. Las ponderaciones deben sumar 100 % (validado en el navegador y en el servidor). Reducciones con autorización y motivo. **Garantía de ingreso** (75 % de la base en los primeros 2 meses) con vista previa y confirmación de periodos.
- **Panel** con filtros por mes, gestor, supervisor y equipo; consolidado descargable (Excel / CSV) solo con personas con comisión configurada.
- **Historial** por mes y acumulado (solo periodos confirmados) y **registro de cambios** (quién, cuándo, qué).
- **Exportación a Excel** con la plantilla EDD original (hoja Resumen + una hoja por mes, p. ej. "Octubre-2026"), individual o en **ZIP** (un archivo por gestor).
- **Imágenes** de EDD y métricos (inicial / final / combinada) para copiar o descargar, y **mensajes de WhatsApp Business** por gestor.
- **Directriz para varios equipos**: una misma directriz (p. ej. "Rendición de cuentas al 100%") para todos los equipos o solo los de un supervisor, aplicada de una vez.
- **Historial anterior al sistema**: los resultados previos a octubre 2026 que traen los archivos EDD individuales pueden escribirse en la hoja Resumen (con revisión y decisiones en la importación).
- **Importación** del Formato EDD, los archivos EDD individuales (uno sirve de plantilla maestra) y los archivos de métricos con vista previa del mapeo, datos interpretados y dudas que el usuario decide antes de guardar.

## Arquitectura

| Capa | Detalle |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript, página estática. |
| Interfaz | Módulos JavaScript del navegador en `public/edd/` (cargados en orden por `app/cargador.tsx`). Estilos de marca PDC en `estilos/app.css`; Tailwind configurado sin *preflight*. |
| Excel | SheetJS (`xlsx`) para leer; JSZip para escribir sobre el XML de la plantilla original y conservar su formato. |
| Datos | Supabase, proyecto `intranet-creditos-cobros`, módulo independiente `edd_*`. |
| Hosting | Vercel (team PDCGroup), despliegue automático desde `main`. |

## Seguridad y roles

- Todas las tablas `edd_*` tienen **RLS activo sin políticas**: la llave pública no puede leerlas ni escribirlas.
- El acceso es solo por funciones RPC `SECURITY DEFINER` (`edd_login`, `edd_cargar`, `edd_guardar`, …) que exigen una **sesión** creada con la **clave de acceso del equipo** (guardada con bcrypt). Cada cambio queda en `edd_auditoria` con el nombre de quien lo hizo.
- **No requiere variables de entorno** en Vercel.
- v1: todos consultan y editan (rol `editor`). Quedan preparados los roles `supervisor` y `consulta` (`edd__puede`), para activarlos con claves separadas.
- La clave inicial **no** está en el repositorio; se cambia en *Configuración → Acceso*.

## Base de datos

Migración: `supabase/migrations/20261021_edd_modulo.sql`. Cada registro es un documento JSON con `version` (control de concurrencia) y auditoría antes/después.

| Tabla | Contenido |
|---|---|
| `edd_personas`, `edd_equipos` | Padrón y equipos |
| `edd_periodos` | Meses (`2026-10`, …); un mes nuevo no reemplaza los anteriores |
| `edd_planes` | Plan común de cada equipo por mes (`edd` o `met`) |
| `edd_evaluaciones`, `edd_metricos` | Registro por persona y mes (plan inicial, resultados, cierre) |
| `edd_config` | Reglas (base, garantía, textos de WhatsApp) y la plantilla EDD limpia |
| `edd_importaciones`, `edd_auditoria` | Bitácora de importaciones y de cambios |

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # verificación antes de publicar
npm test           # reglas de comisión y garantía (incluye los ejemplos Q1,125 y Q1,312.50)
```

Pruebas adicionales en `test/` (lectura de los Excel reales, limpieza de plantilla, generación del libro y prueba de punta a punta con un simulador del servidor).
