import Cargador from './cargador';

const MENU: [string, string][] = [
  ['panel', 'Panel del mes'], ['planes', 'Planes del mes'], ['padron', 'Padrón y equipos'], ['historial', 'Historial'],
  ['exportar', 'Exportar Excel'], ['whatsapp', 'WhatsApp'], ['importar', 'Importar archivos'], ['config', 'Configuración'],
];

// Estructura fija de la página; las pantallas las dibujan los módulos de /public/edd.
export default function Inicio() {
  return (
    <>
      <div id="login" className="login" hidden>
        <form className="login-tarjeta" id="loginForm" autoComplete="on">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/pdc-principal.png" alt="Grupo PDC" className="login-logo" />
          <h1>Evaluaciones, métricos y comisiones</h1>
          <p className="login-sub">Cobros Venta Directa · Team Chévere, Team Imparables y demás equipos</p>
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
            <img src="/assets/pdc-principal-blanco.png" alt="Grupo PDC" />
            <span>EDD · Métricos · Comisiones</span>
          </div>
          <nav className="menu" id="menu">
            {MENU.map(([r, t]) => <a key={r} href={`#/${r}`} data-r={r}>{t}</a>)}
          </nav>
          <div className="lateral-pie"><span id="quien"></span><button className="btn fantasma claro" id="salirBtn" type="button">Cerrar sesión</button></div>
        </aside>
        <div className="principal">
          <header className="barra">
            <button className="icono menu-btn" id="menuBtn" type="button" aria-label="Abrir menú">☰</button>
            <div className="carril" id="carril" aria-label="Meses"></div>
            <button className="btn fantasma" id="recargarBtn" type="button" title="Traer los últimos cambios del equipo">Actualizar</button>
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
