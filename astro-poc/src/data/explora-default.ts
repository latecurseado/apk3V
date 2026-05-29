/**
 * Contenido por defecto de las secciones de "Explora Tres Valles".
 * Cuando un admin pulsa "Inicializar contenido" en una BD vacía,
 * todo esto se inserta en `content_sections`.
 *
 * Tras la inserción, los admins editan las secciones desde la web
 * y los cambios se replican vía Supabase Realtime a todos los visitantes.
 */

export interface DefaultSection {
    section_key: string;
    title: string;
    icon: string;
    sort_order: number;
    body: string;
}

export const exploraDefault: DefaultSection[] = [
    {
        section_key: 'historia',
        sort_order: 10,
        icon: 'fa-landmark',
        title: 'De campamento ferrocarrilero a Municipio Libre',
        body: `
<p class="accent-lead">
    Tres Valles nació del riel y creció con la caña. Su historia es la de un
    campamento que se convirtió en potencia agroindustrial.
</p>
<div class="stat-row">
    <div class="stat-pill"><span class="stat-num">1899-1900</span><span class="stat-label">Campamento Núm. 7</span></div>
    <div class="stat-pill"><span class="stat-num">1913</span><span class="stat-label">Nombre "Tres Valles"</span></div>
    <div class="stat-pill"><span class="stat-num">25 Nov 1988</span><span class="stat-label">Municipio Libre</span></div>
</div>
<h3>Los Orígenes</h3>
<p class="hub-section-lead">
    A finales del siglo XIX, la zona era una vasta extensión de selva y llanura perteneciente a Cosamaloapan, con presencia anterior de pueblos <b>olmecas, totonacos</b> y, al momento de la conquista, bajo dominio <b>azteca</b>. El detonante fue la construcción del <b>Ferrocarril Veracruz al Pacífico</b>: entre <b>1899 y 1900</b> se instaló aquí el <b>Campamento Núm. 7</b>, originando popularmente el nombre <b>"Campo Siete"</b>. Después se llamó <b>"Brisbin"</b> (1908-1913) y finalmente <b>"Tres Valles"</b> desde 1913.
</p>
<h3>El auge poblacional</h3>
<p class="hub-section-lead">
    La instalación del <b>Ingenio Tres Valles (1978)</b> y la fábrica de papel <b>MEXPAPE / Bio Pappel (1972-1979)</b> transformaron el asentamiento rural en un polo de atracción. Miles de migrantes de Oaxaca, Puebla y otras regiones llegaron buscando trabajo en la zafra.
</p>
<h3>La emancipación</h3>
<p class="hub-section-lead">
    Tras años de gestión del <b>Comité Pro Municipio Libre</b>, Tres Valles logró su independencia mediante el <b>Decreto 195</b> de la H. LIV Legislatura, a iniciativa del gobernador <b>Fernando Gutiérrez Barrios</b>. Declarado <b>Municipio Libre el 25 de noviembre de 1988</b>.
</p>`.trim(),
    },
    {
        section_key: 'logo',
        sort_order: 20,
        icon: 'fa-shield-halved',
        title: 'Logo y simbología municipal',
        body: `
<p class="accent-lead">
    Caña, ganadería y vías del tren. Tres pilares productivos condensados en un solo escudo bajo el lema <b>"In Via Prosperitatis"</b>.
</p>
<h3>La caña de azúcar</h3>
<p class="hub-section-lead">
    Símbolo central. Representa las <b>~28,000 hectáreas</b> sembradas que hacen de Tres Valles el <b>quinto productor nacional</b> y el primero de Veracruz, junto al <b>Ingenio Tres Valles</b> (1978).
</p>
<h3>La ganadería</h3>
<p class="hub-section-lead">
    Recuerda la tradición de bovinos de <b>doble propósito</b> (carne y leche) de las zonas ejidales y rancherías, vital para los lácteos artesanales del Sotavento.
</p>
<h3>Las vías del tren</h3>
<p class="hub-section-lead">
    Las <b>vías cruzadas en forma de Y</b> que ocupan el centro del escudo representan el <b>Ferrocarril Veracruz al Pacífico</b>, origen del pueblo en <b>1899-1900</b>. Las leyendas <b>FÉRTIL</b>, <b>CÁLIDO</b> y <b>PRÓSPERO</b> enmarcan el escudo.
</p>`.trim(),
    },
    {
        section_key: 'economia',
        sort_order: 30,
        icon: 'fa-store',
        title: 'Economía: La capital de la agroindustria',
        body: `
<p class="accent-lead">
    Caña, arroz, ganado y un comercio efervescente: el tejido productivo que sostiene a la región entera.
</p>
<div class="stat-row">
    <div class="stat-pill"><span class="stat-num">~28,000 ha</span><span class="stat-label">Caña sembrada</span></div>
    <div class="stat-pill"><span class="stat-num">5º nacional</span><span class="stat-label">Productor de caña</span></div>
    <div class="stat-pill"><span class="stat-num">1º Veracruz</span><span class="stat-label">Producción de arroz</span></div>
</div>
<p class="hub-section-lead">
    <b>Comercio local:</b> Avenida Ruiz Cortines, Avenida Madero y el Mercado Municipal son las venas comerciales. Refaccionarias, abarrotes, ferreterías y servicios.
</p>
<p class="hub-section-lead">
    <b>Agricultura diversificada:</b> Caña, arroz, maíz, sorgo, frijol, piña y mango aprovechan los suelos aluviales fértiles.
</p>
<h3>Directorio de servicios institucionales</h3>
<ul class="hub-poi-list">
    <li><i class="fas fa-building-columns"></i> <b>Gobierno:</b> Palacio Municipal (Calle Enríquez S/N).</li>
    <li><i class="fas fa-tree-city"></i> <b>Recreación:</b> Parque Central Miguel Hidalgo (Av. Juárez).</li>
    <li><i class="fas fa-church"></i> <b>Religión:</b> Parroquia de Cristo Rey.</li>
    <li><i class="fas fa-industry"></i> <b>Industria:</b> Ingenio Tres Valles y Planta Papelera Scribe.</li>
    <li><i class="fas fa-hospital"></i> <b>Salud:</b> Hospital General IMSS 43 (Blvd. Ruiz Cortines).</li>
</ul>`.trim(),
    },
    {
        section_key: 'cana',
        sort_order: 40,
        icon: 'fa-industry',
        title: 'Industria Azucarera: El corazón económico',
        body: `
<p class="accent-lead">
    El ingenio no es solo una fábrica: es el reloj que marca el ritmo de la ciudad seis meses al año.
</p>
<div class="stat-row">
    <div class="stat-pill"><span class="stat-num">13,000 t/día</span><span class="stat-label">Molienda</span></div>
    <div class="stat-pill"><span class="stat-num">37,000 ha</span><span class="stat-label">Abastecimiento</span></div>
    <div class="stat-pill"><span class="stat-num">6,000+</span><span class="stat-label">Cañeros</span></div>
    <div class="stat-pill"><span class="stat-num">40 MW</span><span class="stat-label">Cogeneración</span></div>
</div>
<p class="hub-section-lead">
    Construido en <b>1978</b> y operado desde 1988 por el grupo <b>PIASA</b>, es uno de los más productivos de México. Genera más de <b>1,500 toneladas de azúcar en 24 horas</b>.
</p>
<h3>La zafra</h3>
<p class="hub-section-lead">
    Entre <b>noviembre y mayo</b>, al menos <b>14,000 personas</b> dependen del ciclo: 4,503 cañeros, 3,033 cosechadores, 4,492 jornaleros, 1,502 transportistas y 754 empleados del ingenio.
</p>`.trim(),
    },
    {
        section_key: 'ferrocarril',
        sort_order: 50,
        icon: 'fa-train',
        title: 'Ferrocarril: Las vías del progreso',
        body: `
<p class="accent-lead">
    Sin el riel no habría pueblo. El tren trazó la calle principal y conectó a Tres Valles con Veracruz y el Istmo.
</p>
<p class="hub-section-lead">
    Hoy, aunque el servicio de pasajeros es un recuerdo, las vías siguen siendo una <b>arteria vital para el transporte de carga</b>. Los <b>puentes peatonales de metal</b> sobreviven como monumentos.
</p>`.trim(),
    },
    {
        section_key: 'geografia',
        sort_order: 60,
        icon: 'fa-mountain-sun',
        title: 'Geografía y clima',
        body: `
<div class="stat-row">
    <div class="stat-pill"><span class="stat-num">378.1 km²</span><span class="stat-label">Extensión</span></div>
    <div class="stat-pill"><span class="stat-num">10-50 m</span><span class="stat-label">Altitud</span></div>
    <div class="stat-pill"><span class="stat-num">25.4 °C</span><span class="stat-label">Temp. media</span></div>
    <div class="stat-pill"><span class="stat-num">1,887 mm</span><span class="stat-label">Lluvia anual</span></div>
</div>
<p class="hub-section-lead">
    <b>Planicie costera:</b> Llanuras de inundación del bajo Papaloapan. Clima <b>cálido-húmedo (AW2 según Köppen)</b>, picos máximos en mayo (hasta 45.5 °C).
</p>
<p class="hub-section-lead">
    <b>Hidrografía:</b> Cuenca <b>28 Papaloapan</b>. Ríos principales: <b>Tonto, Amapa y Hondo</b>, más arroyos Mondongo, Coapilla, Coyote, Zapote y Jobo.
</p>`.trim(),
    },
    {
        section_key: 'geologia',
        sort_order: 70,
        icon: 'fa-cubes-stacked',
        title: 'Geología',
        body: `
<p class="hub-section-lead">
    Planicie aluvial del río Papaloapan. Los suelos son <b>fluvisoles, vertisoles y gleysoles</b>, formados por depósitos aluviales recientes. Tierra profunda, oscura y extremadamente fértil.
</p>`.trim(),
    },
    {
        section_key: 'natura',
        sort_order: 80,
        icon: 'fa-leaf',
        title: 'Naturaleza y entorno',
        body: `
<p class="accent-lead">Un oasis verde donde la biodiversidad se esconde entre los cultivos.</p>
<p class="hub-section-lead">
    Ríos perennes como el <b>Amapa</b>, arroyos, esteros y humedales albergan <b>iguanas, tlacuaches, tortugas de agua dulce</b>, <b>garzas blancas</b>, <b>martines pescadores</b> y aves de rapiña.
</p>
<p class="hub-section-lead">
    Los reductos de <b>selva baja caducifolia</b> con <b>Ceiba</b> y <b>Palo Mulato</b> resisten en las periferias.
</p>`.trim(),
    },
    {
        section_key: 'gastronomia',
        sort_order: 90,
        icon: 'fa-utensils',
        title: 'Gastronomía: Sabor a la Cuenca',
        body: `
<p class="hub-section-lead">
    La cocina tresvallense celebra el sotavento con influencia oaxaqueña. El <b>Mercado Municipal</b> y las cocinas económicas son templos del sabor.
</p>
<p class="hub-section-lead">
    <b>Platillos estrella:</b> <b>mojarras fritas</b>, <b>tamales de elote</b> y de masa, <b>picadas</b>, empanadas y <b>caldo de mariscos</b>.
</p>
<p class="hub-section-lead">
    <b>Dulces y lácteos:</b> <b>nieves artesanales</b>, pan dulce de leña, dulces de piloncillo y coco, quesos frescos.
</p>`.trim(),
    },
    {
        section_key: 'musica',
        sort_order: 100,
        icon: 'fa-music',
        title: 'Música y danza',
        body: `
<p class="accent-lead">Tres Valles late a ritmo de son jarocho.</p>
<p class="hub-section-lead">
    La raíz campesina mantiene viva la tradición de la <b>jarana</b>, el <b>requinto</b> y el <b>zapateado</b>.
</p>`.trim(),
    },
    {
        section_key: 'tradiciones',
        sort_order: 110,
        icon: 'fa-mask',
        title: 'Fiestas patronales y Día de Muertos',
        body: `
<p class="hub-section-lead"><b>Calendario oficial:</b></p>
<ul class="hub-poi-list">
    <li><i class="fas fa-masks-theater"></i> <b>Carnaval</b> — abril (fecha movible).</li>
    <li><i class="fas fa-cross"></i> <b>Fiesta de Cristo Rey</b> — 20 de noviembre.</li>
    <li><i class="fas fa-cow"></i> <b>Feria Agrícola, Ganadera, Cultural e Industrial</b> — última semana de noviembre.</li>
</ul>
<p class="hub-section-lead">
    <b>Día de Muertos:</b> altares monumentales, panteones y tamales. La población indígena (~7.85% INEGI 2010) habla principalmente <b>chinanteco</b>, <b>mazateco</b>, zapoteco, náhuatl y mixteco.
</p>`.trim(),
    },
    {
        section_key: 'deporte',
        sort_order: 120,
        icon: 'fa-futbol',
        title: 'Deporte: Pasión en el diamante y la cancha',
        body: `
<p class="hub-section-lead">
    <b>El béisbol (rey de los deportes):</b> pasión histórica. La liga municipal y los torneos regionales son altamente competitivos.
</p>
<p class="hub-section-lead">
    <b>Fútbol y más:</b> El soccer moviliza a cientos de jóvenes. El <b>voleibol</b> y el <b>baloncesto</b> tienen fuerte presencia en escuelas.
</p>`.trim(),
    },
    {
        section_key: 'educacion',
        sort_order: 130,
        icon: 'fa-graduation-cap',
        title: 'Educación y comunidad',
        body: `
<p class="hub-section-lead">
    De preescolares a bachillerato tecnológico (<b>CBTis</b> y <b>TEBAEV</b>). Estudios superiores en <b>Tuxtepec, Veracruz o Xalapa</b>.
</p>
<p class="hub-section-lead">
    La <b>Casa de la Cultura</b> y la <b>biblioteca municipal</b> sostienen talleres artísticos y formación cívica.
</p>`.trim(),
    },
    {
        section_key: 'comunidades',
        sort_order: 140,
        icon: 'fa-house-chimney',
        title: 'Comunidades y localidades',
        body: `
<p class="hub-section-lead">
    Tres Valles está compuesto por congregaciones, ejidos y poblados como <b>Novara</b>, <b>Los Naranjos</b>, <b>Poblado Tres</b> y <b>Poblado Dos</b>.
</p>
<p class="hub-section-lead">
    Cada lugar tiene su propia historia, muchas veces ligada a acomodos ejidales y a la <b>presa Cerro de Oro</b>.
</p>`.trim(),
    },
    {
        section_key: 'llegar',
        sort_order: 150,
        icon: 'fa-route',
        title: 'Cómo llegar',
        body: `
<div class="stat-row">
    <div class="stat-pill"><span class="stat-num">~2 h</span><span class="stat-label">desde Veracruz</span></div>
    <div class="stat-pill"><span class="stat-num">~1 h</span><span class="stat-label">desde Tuxtepec</span></div>
    <div class="stat-pill"><span class="stat-num">~30 min</span><span class="stat-label">desde Tierra Blanca</span></div>
</div>
<p class="hub-section-lead">
    Las terminales locales operan corridas frecuentes a estos destinos por carretera federal y estatal.
</p>`.trim(),
    },
    {
        section_key: 'bibliografia',
        sort_order: 160,
        icon: 'fa-book',
        title: 'Fuentes y bibliografía',
        body: `
<h3>Fuentes oficiales</h3>
<ul class="hub-poi-list">
    <li><i class="fas fa-building-columns"></i> <b>INEGI</b> — Censo de Población y Vivienda 2010 y 2020.</li>
    <li><i class="fas fa-wheat-awn"></i> <b>SAGARPA / SADER</b> — Anuario de producción agrícola.</li>
    <li><i class="fas fa-cloud-sun"></i> <b>Servicio Meteorológico Nacional (CONAGUA)</b>.</li>
    <li><i class="fas fa-scroll"></i> <b>Decreto N° 195</b> de la H. LIV Legislatura de Veracruz (1988).</li>
    <li><i class="fas fa-landmark-flag"></i> <b>INAFED</b> — Enciclopedia de los Municipios de México.</li>
</ul>
<h3>Bibliografía académica</h3>
<ul class="hub-poi-list">
    <li><i class="fas fa-book-open"></i> Corro Ramos, Octaviano (1995). <i>Cosamaloapan. La historia y el hábitat</i>. ISBN 970-626-135-4.</li>
    <li><i class="fas fa-book-open"></i> Yáñez López, Antonio (2007). <i>"Tres Valles parte de la historia"</i>.</li>
    <li><i class="fas fa-book-open"></i> Velasco Toro y Montero García (2005). ISBN 9706262326.</li>
    <li><i class="fas fa-book-open"></i> García de León, Antonio (2011). <i>Tierra adentro, mar en fuera</i>. ISBN 9786071606150.</li>
</ul>
<h3>Fuentes periodísticas</h3>
<ul class="hub-poi-list">
    <li>
        <i class="fas fa-newspaper"></i> <b>Más Noticias</b> —
        <i>"Tres Valles enfrenta bajas ventas; programas sociales dan respiro al comercio"</i>.
        <a href="https://www.masnoticias.mx/tres-valles-enfrenta-bajas-ventas-programas-sociales-dan-respiro-al-comercio/" target="_blank" rel="noopener">masnoticias.mx</a>
    </li>
</ul>
<h3>Compilación general</h3>
<ul class="hub-poi-list">
    <li>
        <i class="fas fa-globe"></i> <b>Wikipedia</b> — "Tres Valles (Veracruz)".
        <a href="https://es.wikipedia.org/wiki/Tres_Valles_(Veracruz)" target="_blank" rel="noopener">es.wikipedia.org</a>
    </li>
    <li><i class="fas fa-school"></i> <b>Universidad Veracruzana</b> — <i>Diccionario Enciclopédico Veracruzano</i>.</li>
</ul>`.trim(),
    },
];
