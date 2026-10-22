import Cargador from './cargador';

const AREAS: [string, string, string][] = [
  ['panel', '▦', 'Resumen'], ['edd', '▤', 'Evaluación EDD'], ['met', '◉', 'Métricos y comisión'], ['padron', '♙', 'Gestores'], ['historial', '◷', 'Historial mensual'],
];
const HERRAMIENTAS: [string, string, string][] = [
  ['planes', '☰', 'Planes del mes'], ['exportar', '⇩', 'Exportar Excel'], ['whatsapp', '✆', 'WhatsApp'], ['importar', '⇧', 'Importar archivos'], ['config', '⚙', 'Configuración'],
];

// Estructura fija de la página; las pantallas las dibujan los módulos de /public/edd.
export default function Inicio() {
  return (
    <>
      <div id="login" className="login" hidden>
        <form className="login-tarjeta" id="loginForm" autoComplete="on">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/pdc-principal.png" alt="Grupo PDC" className="login-logo" />
          <h1>Desempeño &amp; Métricos</h1>
          <p className="login-sub">Evaluaciones EDD, métricos y comisiones · Cobros Venta Directa</p>
          <label className="f"><span>Tu nombre</span><input id="loginNombre" className="campo" autoComplete="name" placeholder="Así quedará registrado quién hace cada cambio" required /></label>
          <label className="f"><span>Clave de acceso del equipo</span><input id="loginClave" className="campo" type="password" autoComplete="current-password" required /></label>
          <button className="btn primario ancho" type="submit" id="loginBtn">Entrar</button>
          <p id="loginError" className="aviso err" hidden></p>
        </form>
      </div>

      <div id="app" className="app" hidden>
        <aside className="lateral" id="lateral">
          <div className="marca">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="marca-ico"><img src="/assets/sonrisa-blanca.png" alt="" /></div>
            <div><strong>Desempeño &amp; Métricos</strong><small>Gestión mensual de equipo · Grupo PDC</small></div>
          </div>
          <nav id="menu" aria-label="Secciones">
            <div className="nav-label">Workspace</div>
            <div className="menu">{AREAS.map(([r, i, t]) => <a key={r} href={`#/${r}`} data-r={r}><span className="ico" aria-hidden="true">{i}</span>{t}</a>)}</div>
            <div className="nav-label" style={{ marginTop: 20 }}>Herramientas</div>
            <div className="menu">{HERRAMIENTAS.map(([r, i, t]) => <a key={r} href={`#/${r}`} data-r={r}><span className="ico" aria-hidden="true">{i}</span>{t}</a>)}</div>
          </nav>
          <div className="lateral-pie"><span id="quien"></span><button className="btn claro mini" id="salirBtn" type="button">Cerrar sesión</button></div>
        </aside>
        <div className="principal">
          <header className="barra">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="icono menu-btn" id="menuBtn" type="button" aria-label="Abrir menú">☰</button>
              <div className="crumb">Workspace <span style={{ color: '#b6c0cb' }}>/</span> <b id="crumb">Resumen</b></div>
            </div>
            <div className="barra-der">
              <div id="carril"></div>
              <button className="btn mini fantasma" id="recargarBtn" type="button" title="Traer los últimos cambios del equipo">↻ Actualizar</button>
              <div className="avatar" id="avatar" title=""></div>
            </div>
          </header>
          <main id="vista" className="vista" tabIndex={-1}></main>
        </div>
      </div>
      <div id="modales"></div>
      <div id="toasts" className="toasts" aria-live="polite"></div>
      <Cargador />
    </>
  );
}
