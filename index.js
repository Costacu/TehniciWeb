const express = require('express');
const fs = require('fs');
const path = require('path');

let sass = null;
try {
  sass = require('sass');
} catch {
  sass = null;
}

const app = express();
const port = process.env.PORT || 8080;
const directorCurent = __dirname;
const fisierCurent = __filename;
const directorLucru = process.cwd();

const obGlobal = {
  obErori: null,
  folderCss: path.join(directorCurent, 'resurse', 'css'),
  folderBackup: path.join(directorCurent, 'backup'),
  foldereScss: [path.join(directorCurent, 'resurse', 'scss')],
  directorCurent,
  fisierCurent,
  directorLucru
};

app.set('view engine', 'ejs');
app.set('views', path.join(directorCurent, 'views'));

app.use((req, res, next) => {
  res.locals.ip = req.ip;
  next();
});

function asiguraFolder(caleFolder) {
  if (!fs.existsSync(caleFolder)) {
    fs.mkdirSync(caleFolder, { recursive: true });
  }
}

function caleWeb(...segmente) {
  return segmente.join('/').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/ /g, '%20');
}

const vect_foldere = ['temp', 'logs', 'backup', 'fisiere_uploadate'];
vect_foldere.forEach(numeFolder => {
  const test_foldere = path.join(directorCurent, numeFolder);
  if (!fs.existsSync(test_foldere)) {
    asiguraFolder(test_foldere);
  }
});

function detecteazaCheiDuplicateJson(continutJson) {
  const stiva = [];
  const duplicate = [];

  const varfObiect = () => {
    if (stiva.length === 0) {
      return null;
    }
    const varf = stiva[stiva.length - 1];
    return varf.tip === 'object' ? varf : null;
  };

  for (let i = 0; i < continutJson.length; i += 1) {
    const caracter = continutJson[i];

    if (/\s/.test(caracter)) {
      continue;
    }

    if (caracter === '{') {
      stiva.push({ tip: 'object', chei: new Set(), asteaptaCheie: true });
      continue;
    }

    if (caracter === '}') {
      stiva.pop();
      continue;
    }

    if (caracter === '[') {
      stiva.push({ tip: 'array' });
      continue;
    }

    if (caracter === ']') {
      stiva.pop();
      continue;
    }

    if (caracter === ',') {
      const obj = varfObiect();
      if (obj) {
        obj.asteaptaCheie = true;
      }
      continue;
    }

    if (caracter === ':') {
      continue;
    }

    if (caracter === '"') {
      let j = i + 1;
      let valoare = '';
      while (j < continutJson.length) {
        const ch = continutJson[j];
        if (ch === '\\') {
          const urmator = continutJson[j + 1] || '';
          valoare += ch + urmator;
          j += 2;
          continue;
        }
        if (ch === '"') {
          break;
        }
        valoare += ch;
        j += 1;
      }

      const obj = varfObiect();
      if (obj && obj.asteaptaCheie) {
        if (obj.chei.has(valoare)) {
          duplicate.push(valoare);
        } else {
          obj.chei.add(valoare);
        }
        obj.asteaptaCheie = false;
      }

      i = j;
    }
  }

  return duplicate;
}

function compileazaScss(caleScss, caleCss) {
  if (!sass) {
    return;
  }

  const caleScssAbsoluta = path.isAbsolute(caleScss) ? caleScss : path.join(directorCurent, caleScss);
  let caleCssAbsoluta = caleCss;

  if (!caleCssAbsoluta) {
    const numeFisier = path.basename(caleScssAbsoluta, '.scss');
    caleCssAbsoluta = path.join(obGlobal.folderCss, `${numeFisier}.css`);
  } else if (!path.isAbsolute(caleCssAbsoluta)) {
    caleCssAbsoluta = path.join(obGlobal.folderCss, caleCssAbsoluta);
  }

  const folderBackupCss = path.join(obGlobal.folderBackup, 'resurse', 'css');
  asiguraFolder(folderBackupCss);

  if (fs.existsSync(caleCssAbsoluta)) {
    fs.copyFileSync(caleCssAbsoluta, path.join(folderBackupCss, path.basename(caleCssAbsoluta)));
  }

  const rezultat = sass.compile(caleScssAbsoluta, { style: 'expanded' });
  fs.writeFileSync(caleCssAbsoluta, rezultat.css, 'utf8');
}

function compileazaToateScss() {
  if (!sass) {
    return;
  }

  for (const folderScss of obGlobal.foldereScss) {
    if (!fs.existsSync(folderScss)) {
      continue;
    }

    for (const numeFisier of fs.readdirSync(folderScss)) {
      if (path.extname(numeFisier).toLowerCase() === '.scss') {
        compileazaScss(path.join(folderScss, numeFisier));
      }
    }

    fs.watch(folderScss, (eveniment, numeFisier) => {
      if (!numeFisier || (eveniment !== 'change' && eveniment !== 'rename')) {
        return;
      }

      const caleFisier = path.join(folderScss, numeFisier);
      if (fs.existsSync(caleFisier) && path.extname(caleFisier).toLowerCase() === '.scss') {
        compileazaScss(caleFisier);
      }
    });
  }
}

function initErori() {
  const caleJson = path.join(directorCurent, 'resurse', 'json', 'erori.json');

  try {
    const continut = fs.readFileSync(caleJson, 'utf8');
    const cheiDuplicate = detecteazaCheiDuplicateJson(continut);
    if (cheiDuplicate.length > 0) {
      const frecvente = new Map();
      cheiDuplicate.forEach(cheie => {
        frecvente.set(cheie, (frecvente.get(cheie) || 1) + 1);
      });
      const detalii = Array.from(frecvente.entries())
        .map(([cheie, aparitii]) => `"${cheie}" apare de ${aparitii} ori`)
        .join('; ');
      throw new Error(`JSON invalid: exista proprietati duplicate in acelasi obiect (${detalii}).`);
    }

    const date = JSON.parse(continut);

    if (!date || typeof date !== 'object') {
      throw new Error('Fisierul de erori trebuie sa contina un obiect JSON.');
    }

    if (!date.cale_baza || typeof date.cale_baza !== 'string') {
      throw new Error('Lipseste proprietatea "cale_baza" din fisierul de erori.');
    }

    const folderBaza = path.join(directorCurent, date.cale_baza);
    if (!fs.existsSync(folderBaza)) {
      throw new Error(`Folderul specificat in "cale_baza" nu exista: ${date.cale_baza}`);
    }

    if (!date.eroare_default || typeof date.eroare_default !== 'object') {
      throw new Error('Lipseste obiectul "eroare_default".');
    }

    if (!Array.isArray(date.info_erori)) {
      throw new Error('"info_erori" trebuie sa fie un vector de obiecte.');
    }

    const identificatori = new Map();
    date.info_erori.forEach(eroare => {
      const id = String(eroare.identificator);
      if (!identificatori.has(id)) {
        identificatori.set(id, []);
      }
      identificatori.get(id).push(eroare);
    });

    const duplicateId = Array.from(identificatori.entries()).filter(([, erori]) => erori.length > 1);
    if (duplicateId.length > 0) {
      const mesaj = duplicateId
        .map(([id, erori]) => {
          const detaliiErori = erori
            .map((eroare, index) => {
              const proprietati = Object.entries(eroare)
                .map(([cheie, valoare]) => `${cheie}=${JSON.stringify(valoare)}`)
                .join(', ');
              return `eroare_${index + 1} { ${proprietati} }`;
            })
            .join(' | ');
          return `identificator ${id}: ${detaliiErori}`;
        })
        .join(' ; ');
      throw new Error(`JSON invalid: exista mai multe erori cu acelasi identificator. Detalii: ${mesaj}`);
    }

    const campuriNecesare = ['identificator', 'status', 'titlu', 'text', 'imagine'];
    const verificareEroare = eroare => {
      for (const camp of campuriNecesare) {
        if (eroare[camp] === undefined || eroare[camp] === null || eroare[camp] === '') {
          throw new Error(`Eroare invalida in JSON: lipseste campul "${camp}".`);
        }
      }

      const caleImagine = path.join(folderBaza, eroare.imagine);
      if (!fs.existsSync(caleImagine)) {
        throw new Error(`Imaginea pentru eroare nu exista: ${caleImagine}`);
      }
    };

    verificareEroare(date.eroare_default);
    date.info_erori.forEach(verificareEroare);

    date.eroare_default.imagine = '/' + caleWeb(date.cale_baza, date.eroare_default.imagine);
    date.info_erori.forEach(eroare => {
      eroare.imagine = '/' + caleWeb(date.cale_baza, eroare.imagine);
    });

    obGlobal.obErori = date;
  } catch (eroare) {
    console.error('Eroare la initializarea fisierului de erori:');
    console.error(eroare.message);
    process.exit(1);
  }
}

function obtineEroare(identificator) {
  if (!obGlobal.obErori) {
    return null;
  }

  if (identificator === undefined || identificator === null) {
    return obGlobal.obErori.eroare_default;
  }

  const potriviri = obGlobal.obErori.info_erori.filter(eroare => String(eroare.identificator) === String(identificator) || String(eroare.status) === String(identificator));
  return potriviri[0] || obGlobal.obErori.eroare_default;
}

function afisareEroare(res, identificator, titlu, text, imagine, statusOverride) {
  const eroare = obtineEroare(identificator) || {
    status: 404,
    titlu: 'Eroare',
    text: 'A aparut o eroare.',
    imagine: undefined
  };

  const status = statusOverride || eroare.status || Number(identificator) || 404;

  return res.status(status).render('pagini/eroare', {
    pagina: 'Eroare',
    titlu: titlu || eroare.titlu,
    text: text || eroare.text,
    imagine: imagine || eroare.imagine,
    status
  });
}

function paginaExista(numePagina) {
  const calePagina = path.join(directorCurent, 'views', 'pagini', `${numePagina}.ejs`);
  return fs.existsSync(calePagina);
}

function randarePagina(numePagina) {
  return (req, res) => {
    if (!paginaExista(numePagina)) {
      return afisareEroare(res, 404);
    }

    return res.render(`pagini/${numePagina}`, {
      pagina: numePagina,
      titlu: numePagina === 'index' ? 'Gridline F1 Store' : numePagina
    }, (eroare, rezultatRandare) => {
      if (eroare) {
        if (eroare.message && eroare.message.startsWith('Failed to lookup view')) {
          return afisareEroare(res, 404);
        }
        return afisareEroare(
          res,
          undefined,
          'Eroare generica',
          'A aparut o eroare la randarea paginii.',
          undefined,
          500
        );
      }

      return res.send(rezultatRandare);
    });
  };
}

initErori();
compileazaToateScss();

app.use((req, res, next) => {
  const caleCerere = req.path.replace(/\\/g, '/');

  if (caleCerere.toLowerCase().endsWith('.ejs')) {
    return afisareEroare(res, 400);
  }

  if (caleCerere === '/resurse' || caleCerere === '/resurse/' || (caleCerere.startsWith('/resurse/') && !path.posix.extname(caleCerere))) {
    return afisareEroare(res, 403);
  }

  return next();
});

app.use('/resurse', express.static(path.join(directorCurent, 'resurse')));
app.use('/resurse/ico', express.static(path.join(directorCurent, 'resurse', 'imagini', 'favicon')));
app.use('/resurse/fisiere', express.static(path.join(directorCurent, 'resurse', 'imagini')));

app.use(express.static(directorCurent, { index: false }));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(directorCurent, 'resurse', 'imagini', 'favicon', 'favicon.ico'));
});

app.get(['/', '/index', '/home'], randarePagina('index'));

app.get('/*', (req, res) => {
  const numePagina = req.path.replace(/^\/+/, '');

  if (!numePagina) {
    return randarePagina('index')(req, res);
  }

  if (!paginaExista(numePagina)) {
    return afisareEroare(res, 404);
  }

  return res.render(`pagini/${numePagina}`, {
    pagina: numePagina,
    titlu: numePagina === 'index' ? 'Gridline F1 Store' : numePagina === 'about' ? 'Despre noi' : numePagina === 'galerie' ? 'Galerie statică' : numePagina === 'galerie-dinamica' ? 'Galerie dinamică' : numePagina
  }, (eroare, rezultatRandare) => {
    if (eroare) {
      if (eroare.message && eroare.message.startsWith('Failed to lookup view')) {
        return afisareEroare(res, 404);
      }
      return afisareEroare(
        res,
        undefined,
        'Eroare generica',
        'A aparut o eroare la randarea paginii.',
        undefined,
        500
      );
    }

    return res.send(rezultatRandare);
  });
});

app.use((req, res) => {
  afisareEroare(res, 404);
});

app.listen(port, () => {
  console.log(`Gridline F1 ruleaza la http://localhost:${port}`);
  console.log(`Entry point: ${fisierCurent}`);
  console.log(`Working dir: ${directorLucru}`);
});
