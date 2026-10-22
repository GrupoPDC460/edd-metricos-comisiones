import asyncio, os, subprocess, time, json, sys
from playwright.async_api import async_playwright
ROOT='/home/claude/edd'; OUTDIR='/home/claude/x/shots2'; OUT='/home/claude/x/shots4'; os.makedirs(OUT, exist_ok=True)
UP='/mnt/user-data/uploads/'
srv = subprocess.Popen(['true'])
time.sleep(1)
errores=[]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True)
        await ctx.grant_permissions(['clipboard-read','clipboard-write'], origin='http://localhost:3000')
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errores.append('pageerror: '+str(e)))
        page.on('console', lambda m: errores.append('console: '+m.text) if m.type=='error' else None)
        async def cdn(route):
            u=route.request.url
            if 'xlsx' in u: await route.fulfill(path=ROOT+'/test/node_modules/xlsx/dist/xlsx.full.min.js', content_type='application/javascript')
            elif 'jszip' in u: await route.fulfill(path=ROOT+'/test/node_modules/jszip/dist/jszip.min.js', content_type='application/javascript')
            else: await route.abort()
        await page.route('**/cdnjs.cloudflare.com/**', cdn)
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        await page.goto('http://localhost:3000/'); await page.wait_for_function('window.EDD && window.EDD.app && window.EDD.app.render && !document.getElementById("login").hidden')
        await page.evaluate(open(ROOT+'/test/mock.js').read())
        await page.screenshot(path=OUT+'/01_login.png')
        await page.fill('#loginNombre','Daniel Monge'); await page.fill('#loginClave','mala'); await page.click('#loginBtn')
        await page.wait_for_selector('#loginError:not([hidden])'); print('login error msg:', await page.inner_text('#loginError'))
        await page.fill('#loginClave','CLAVE-PRUEBA'); await page.click('#loginBtn')
        await page.wait_for_selector('#app:not([hidden])')
        await page.wait_for_timeout(300)
        print('hash after login', await page.evaluate('location.hash'))
        await page.screenshot(path=OUT+'/02_importar.png')
        # subir archivos
        files=[UP+f for f in os.listdir(UP) if f.endswith('.xlsx') and f!='Formato_EDD.xlsx']
        await page.set_input_files('input[type=file]', files)
        await page.wait_for_function("document.body.innerText.includes('archivo(s) listos')", timeout=120000)
        await page.screenshot(path=OUT+'/02b_archivos.png'); await page.click('text=Analizar archivos'); await page.wait_for_selector('.pestanas', timeout=60000); await page.screenshot(path=OUT+'/02c_tras.png'); print('toasts', await page.inner_text('#toasts'))
        await page.wait_for_selector('.pestanas', timeout=60000)
        await page.screenshot(path=OUT+'/03_resumen.png', full_page=True)
        for tab in ['Mapeo detectado','Equipos','Personas']:
            await page.click('.pestanas button:has-text("%s")'%tab); await page.wait_for_timeout(200)
            await page.screenshot(path=OUT+'/04_%s.png'%tab.split()[0], full_page=True)
        await page.click('.pestanas button:has-text("Dudas")'); await page.wait_for_timeout(200)
        # decisiones: elegir opciones
        async def elegir(texto_titulo, opcion):
            box = page.locator('.duda.decision', has_text=texto_titulo)
            await box.locator('label.opcion', has_text=opcion).locator('input').check()
        await elegir('Jocelyn Santos', 'Yoselin De Los Santos')
        await elegir('Gerardo Velásquez', 'Henry Geovanni')
        await elegir('Julio Alexander', 'Team Chévere')
        await elegir('Dahirin', 'Usar Q1,250.00')
        await elegir('Mishelle', 'base predeterminada')
        await elegir('Giselle', 'Usar 22/09/2026')
        await elegir('Confirma quién sigue activo', 'Revisé la lista')
        await elegir('Resultados anteriores', 'Incluirlos en la hoja')
        await page.click('.pestanas button:has-text("Archivos EDD")'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'/05b_archivos.png', full_page=True)
        await page.click('.pestanas button:has-text("Dudas")'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT+'/05_dudas.png', full_page=True)
        await page.click('.pestanas button:has-text("Vista previa")'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'/06_guardar.png', full_page=True)
        await page.click('text=Confirmar e importar')
        await page.wait_for_function("location.hash==='#/panel'", timeout=30000)
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT+'/07_panel.png', full_page=True)
        n = await page.evaluate("({p: EDD.db.personas.size, e: EDD.db.evaluaciones.size, m: EDD.db.metricos.size, pl: EDD.db.planes.size, eq: EDD.db.equipos.size, tpl: !!EDD.plantilla()})"); print('db', n)
        # ficha Heidi
        await page.evaluate("location.hash='#/ficha/2026-10/p-15547/edd'"); await page.wait_for_timeout(800)
        await page.screenshot(path=OUT+'/08_ficha_edd_inicial.png', full_page=True)
        items = page.locator('.item')
        cnt = await items.count(); print('items Heidi', cnt)
        for i in range(cnt):
            await items.nth(i).locator('.segmento button', has_text='Cumple' if i!=2 else 'No cumple').first.click()
        await page.select_option('.hoja select >> nth=0', 'Alcanza Expectativas')
        await page.select_option('.hoja select >> nth=1', 'Daniel Michael Monge Lopez')
        await page.fill('textarea[placeholder^="Comentarios"]', 'Heidi, buen mes. Reforzar el control de formatos de RECs.')
        await page.click('button:has-text("Guardar cambios")'); await page.wait_for_timeout(700)
        await page.click('button:has-text("Autorizar y cerrar")'); await page.wait_for_timeout(300)
        await page.click('.modal button:has-text("Autorizar y cerrar")'); await page.wait_for_timeout(900)
        await page.screenshot(path=OUT+'/09_ficha_edd_cerrada.png', full_page=True)
        # métricos
        await page.evaluate("location.hash='#/ficha/2026-10/p-15547/met'"); await page.wait_for_timeout(800)
        cums = page.locator('input[placeholder="0–100"]')
        vals=['100','100','50']
        for i in range(await cums.count()):
            await cums.nth(i).fill(vals[i]); await cums.nth(i).dispatch_event('change'); await page.wait_for_timeout(150)
        # intentar cerrar sin autorización de reducción
        await page.click('button:has-text("Cerrar métricos")'); await page.wait_for_timeout(400)
        print('modal falta:', await page.inner_text('.modal-cuerpo'))
        await page.click('.modal button:has-text("Cerrar")'); await page.wait_for_timeout(200)
        red = page.locator('.reduc')
        await red.locator('select').select_option('Daniel Michael Monge Lopez')
        await red.locator('input').fill('Promesas rotas al 37% al corte del 26 de octubre')
        await page.click('button:has-text("Guardar cambios")'); await page.wait_for_timeout(700)
        await page.screenshot(path=OUT+'/10_ficha_met.png', full_page=True)
        await page.click('button:has-text("Cerrar métricos")'); await page.wait_for_timeout(300)
        await page.click('.modal button:has-text("Cerrar métricos")'); await page.wait_for_timeout(900)
        tot = await page.evaluate("EDD.metricos('2026-10','p-15547').d.cierre"); print('cierre Heidi', tot)
        await page.screenshot(path=OUT+'/11_ficha_met_cerrado.png', full_page=True)
        # pesos inválidos en otra persona
        await page.evaluate("location.hash='#/ficha/2026-10/p-15549/met'"); await page.wait_for_timeout(700)
        pesos = page.locator('input[data-peso]')
        await pesos.nth(0).fill('30'); await pesos.nth(0).dispatch_event('input')
        await page.click('button:has-text("Guardar cambios")'); await page.wait_for_timeout(500)
        print('toast pesos:', await page.inner_text('#toasts'))
        print('campos marcados:', await page.locator('input[data-peso].err').count())
        # Giselle garantía
        await page.evaluate("location.hash='#/planes'"); await page.wait_for_timeout(800)
        await page.screenshot(path=OUT+'/12_planes.png', full_page=True)
        # directriz para varios equipos
        await page.fill('textarea[placeholder^="Ej.: Rendición"]', 'Rendición de cuentas al 100%')
        await page.click('button:has-text("Agregar a los equipos marcados")'); await page.wait_for_timeout(1500)
        print('toast directriz:', await page.inner_text('#toasts'))
        print('items Diego tras directriz:', await page.evaluate("EDD.evaluacion('2026-10','p-15523').d.items.map(i=>i.origen+':'+i.texto.slice(0,25))"))
        print('Giselle (excepción):', await page.evaluate("EDD.evaluacion('2026-10','p-15872').d.items.map(i=>i.texto.slice(0,25))")); print('Heidi (cerrada) sin cambios:', await page.evaluate("EDD.evaluacion('2026-10','p-15547').d.items.length"))
        while await page.locator('.modal-fondo').count():
            await page.locator('.modal-fondo .modal-pie button').last.click(); await page.wait_for_timeout(200)
        # aplicar plan EDD Chevere
        await page.locator('.hoja', has_text='Team Chévere').locator('button:has-text("Aplicar al equipo")').first.click(); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT+'/13_aplicar.png')
        await page.click('.modal button:has-text("Cancelar")')
        # confirmar garantía Giselle
        g = page.locator('tr', has_text='Giselle')
        await g.locator('button').first.click(); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'/14_garantia.png')
        await page.click('.modal button:has-text("Confirmar periodos")'); await page.wait_for_timeout(700)
        print('garantia giselle', await page.evaluate("EDD.persona('p-15872').d.garantia"))
        # whatsapp
        await page.evaluate("location.hash='#/edd/p-15547'"); await page.wait_for_timeout(700); await page.click('button:has-text("✆ Mensaje")'); await page.wait_for_timeout(400)
        await page.click('.toggle button:has-text("Resultado")'); await page.wait_for_timeout(200)
        print('mensaje:', (await page.input_value('.modal textarea'))[:300])
        await page.screenshot(path=OUT+'/15_mensaje.png', full_page=True)
        await page.keyboard.press('Escape'); await page.wait_for_timeout(200)
        # export
        await page.evaluate("location.hash='#/exportar'"); await page.wait_for_timeout(900)
        await page.screenshot(path=OUT+'/16_exportar.png', full_page=True)
        async with page.expect_download() as dl:
            await page.click('button:has-text("Descargar ZIP")'); await page.wait_for_timeout(300)
            await page.click('.modal button:has-text("Generar")')
        d = await dl.value; await d.save_as('/home/claude/x/lote.zip'); print('zip', d.suggested_filename)
        # panel con filtro y consolidado
        await page.evaluate("location.hash='#/panel'"); await page.wait_for_timeout(700)
        async with page.expect_download() as dl2:
            await page.click('button:has-text("Exportar consolidado")')
        d2 = await dl2.value; await d2.save_as('/home/claude/x/consolidado.xlsx'); print('consolidado', d2.suggested_filename)
        await page.screenshot(path=OUT+'/17_panel2.png', full_page=True)
        for r in ['edd/p-15542','met/p-15542']:
            await page.evaluate("location.hash='#/%s'"%r); await page.wait_for_timeout(900)
            await page.screenshot(path=OUT+'/18_%s.png'%r.split('/')[0], full_page=True)
        for r in ['padron','historial','whatsapp','config']:
            await page.evaluate("location.hash='#/%s'"%r); await page.wait_for_timeout(700)
            await page.screenshot(path=OUT+'/18_%s.png'%r, full_page=True)
        # imagen combinada
        canv = await page.evaluate("""(async()=>{const p=EDD.persona('p-15547'); const c=EDD.render.unir([await EDD.render.edd(EDD.render.datosEdd('2026-10',p,'final')), await EDD.render.metricos(EDD.render.datosMet('2026-10',p,'final'))]); return c.toDataURL('image/png');})()""")
        import base64; open('/home/claude/x/shots4/19_combinada.png','wb').write(base64.b64decode(canv.split(',')[1]))
        canv = await page.evaluate("""(async()=>{const p=EDD.persona('p-15872'); const c=EDD.render.unir([await EDD.render.edd(EDD.render.datosEdd('2026-10',p,'inicial')), await EDD.render.metricos(EDD.render.datosMet('2026-10',p,'inicial'))]); return c.toDataURL('image/png');})()""")
        open('/home/claude/x/shots4/20_inicial_giselle.png','wb').write(base64.b64decode(canv.split(',')[1]))
        # mobile
        await page.set_viewport_size({'width':390,'height':844})
        await page.evaluate("location.hash='#/ficha/2026-10/p-15549/edd'"); await page.wait_for_timeout(700)
        await page.screenshot(path=OUT+'/21_movil.png', full_page=False)
        await b.close()
try:
    asyncio.run(main())
finally:
    srv.terminate()
print('ERRORES:', json.dumps(errores[:30], ensure_ascii=False, indent=1))
