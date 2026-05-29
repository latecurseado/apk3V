export interface Video {
    youtube_id: string;
    title: string;
    description: string;
    author: string;
    source_url: string;
    year?: number;
}

export const videos: Video[] = [
    {
        youtube_id: 'SwljRmZDFi0',
        title: 'Orgullo Veracruzano · Tres Valles',
        description: 'Acompaña a Felley a conocer el Municipio de Tres Valles, Veracruz.',
        author: 'TVMÁS RTV',
        source_url: 'https://www.youtube.com/@TVMASRTV',
        year: 2021,
    },
    {
        youtube_id: 'p7yp1F6JV0E',
        title: 'Tres Valles — Recorrido por el municipio',
        description: 'Recorrido por las calles, el parque central y los puntos emblemáticos.',
        author: 'Comunidad Tres Valles',
        source_url: 'https://www.youtube.com/results?search_query=Tres+Valles+Veracruz',
        year: 2023,
    },
    {
        youtube_id: '_xZ50sP9YJI',
        title: 'Zafra en el Ingenio Tres Valles',
        description: 'La temporada de zafra y la producción de azúcar.',
        author: 'Reportaje regional',
        source_url: 'https://www.youtube.com/results?search_query=Ingenio+Tres+Valles+zafra',
        year: 2022,
    },
];
