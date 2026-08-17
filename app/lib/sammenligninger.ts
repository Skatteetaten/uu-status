/**
 * Kuratert liste over virksomheter UU-status sammenlignes mot.
 *
 * Portet uendret fra den gamle docs/benchmark.js. Matching skjer primaert paa
 * organisasjonsnummer; alias og urlIncludes fanger opp poster der
 * organisasjonsnummeret varierer eller mangler.
 */
export interface Sammenligning {
  key: string;
  name: string;
  aliases?: string[];
  orgNumbers?: string[];
  urlIncludes?: string[];
}

export const SAMMENLIGNINGER: Sammenligning[] = [
  {
    "key": "skatteetaten",
    "name": "Skatteetaten",
    "aliases": [
      "skatteetaten",
      "skatteetatens"
    ],
    "orgNumbers": [
      "974761076"
    ]
  },
  {
    "key": "nav",
    "name": "NAV",
    "aliases": [
      "arbeids og velferdsetaten",
      "arbeids- og velferdsetaten"
    ],
    "orgNumbers": [
      "889640782"
    ]
  },
  {
    "key": "helsenorge_helsedirektoratet",
    "name": "Helsenorge / Helsedirektoratet",
    "aliases": [
      "helsedirektoratet",
      "norsk helsenett"
    ],
    "orgNumbers": [
      "994598759",
      "983544622"
    ]
  },
  {
    "key": "domstolene",
    "name": "Domstolene",
    "aliases": [
      "domstolene",
      "domstoladministrasjonen",
      "domstol",
      "hoyesterett",
      "høgesterett"
    ],
    "orgNumbers": [
      "926721720",
      "926721380"
    ]
  },
  {
    "key": "regjeringen",
    "name": "Regjeringen.no",
    "aliases": [
      "departementet",
      "departementene",
      "statsministerens kontor"
    ],
    "urlIncludes": [
      "regjeringen.no"
    ],
    "orgNumbers": [
      "977161630",
      "932931311",
      "872417842"
    ]
  },
  {
    "key": "statens_vegvesen",
    "name": "Statens vegvesen",
    "aliases": [
      "statens vegvesen"
    ],
    "orgNumbers": [
      "971032081"
    ]
  },
  {
    "key": "oslo_kommune",
    "name": "Oslo kommune",
    "aliases": [
      "oslo kommune"
    ],
    "orgNumbers": [
      "958935420"
    ]
  },
  {
    "key": "forsvaret",
    "name": "Forsvaret",
    "aliases": [
      "forsvaret"
    ],
    "orgNumbers": [
      "986105174"
    ]
  },
  {
    "key": "politi_lensmannsetaten",
    "name": "Politidirektoratet",
    "aliases": [
      "politidirektoratet"
    ],
    "orgNumbers": [
      "982531950"
    ]
  },
  {
    "key": "utlendingsdirektoratet",
    "name": "Utlendingsdirektoratet",
    "aliases": [
      "utlendingsdirektoratet"
    ],
    "orgNumbers": [
      "974760746"
    ]
  },
  {
    "key": "digdir",
    "name": "Digdir",
    "aliases": [
      "digitaliseringsdirektoratet",
      "digdir"
    ],
    "orgNumbers": [
      "991825827"
    ]
  },
  {
    "key": "ssb",
    "name": "Statistisk sentralbyrå (SSB)",
    "aliases": [
      "statistisk sentralbyrå",
      "statistisk sentralbyra",
      "ssb"
    ],
    "orgNumbers": [
      "971526920"
    ]
  },
  {
    "key": "drammen_kommune",
    "name": "Drammen kommune",
    "aliases": [
      "drammen kommune"
    ],
    "orgNumbers": [
      "921234554"
    ]
  },
  {
    "key": "bergen_kommune",
    "name": "Bergen kommune",
    "aliases": [
      "bergen kommune"
    ],
    "orgNumbers": [
      "964338531"
    ]
  },
  {
    "key": "baerum_kommune",
    "name": "Bærum kommune",
    "aliases": [
      "bærum kommune",
      "baerum kommune"
    ],
    "orgNumbers": [
      "935478715"
    ]
  },
  {
    "key": "vestland_fylkeskommune",
    "name": "Vestland fylkeskommune",
    "aliases": [
      "vestland fylkeskommune"
    ],
    "orgNumbers": [
      "821311632"
    ]
  },
  {
    "key": "innlandet_fylkeskommune",
    "name": "Innlandet fylkeskommune",
    "aliases": [
      "innlandet fylkeskommune"
    ],
    "orgNumbers": [
      "920717152"
    ]
  },
  {
    "key": "kvinesdal_kommune",
    "name": "Kvinesdal kommune",
    "aliases": [
      "kvinesdal kommune"
    ],
    "orgNumbers": [
      "964964076"
    ]
  },
  {
    "key": "akershus_fylkeskommune",
    "name": "Akershus fylkeskommune",
    "aliases": [
      "akershus fylkeskommune"
    ],
    "orgNumbers": [
      "930580783"
    ]
  },
  {
    "key": "agder_fylkeskommune",
    "name": "Agder fylkeskommune",
    "aliases": [
      "agder fylkeskommune"
    ],
    "orgNumbers": [
      "921707134"
    ]
  },
  {
    "key": "asker_kommune",
    "name": "Asker kommune",
    "aliases": [
      "asker kommune"
    ],
    "orgNumbers": [
      "920125298"
    ]
  },
  {
    "key": "nordre_follo_kommune",
    "name": "Nordre Follo kommune",
    "aliases": [
      "nordre follo kommune"
    ],
    "orgNumbers": [
      "922092648"
    ]
  }
];

/** Virksomheter som er kommune eller fylkeskommune, for filteret i tabellen. */
export const KOMMUNALE = new Set<string>(
  SAMMENLIGNINGER.filter((s) =>
    /kommune|fylkeskommune/i.test(s.name)
  ).map((s) => s.key)
);
