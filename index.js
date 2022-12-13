const { application } = require('express');
const express = require('express');
const ngrok = require('ngrok');
const xml2js = require('xml2js');
const { dis_tub_query, dis_sup_query } = require('./services/queries')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const sql = require("mssql");
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();

const { ADASA_DATABASE, ADASA_USERNAME, ADASA_PASSWORD, ADASA_HOST, SUPABASE_URL, SUPABASE_KEY } = process.env;

// configurações do banco
const config = {
    user: ADASA_USERNAME,
    password: ADASA_PASSWORD,
    server: ADASA_HOST,
    database: ADASA_DATABASE,
    trustServerCertificate: true,
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
/*
(async function () {
    // token ngrok - ver site da empresa
    const { NGROK_TOKEN } = process.env;
    await ngrok.authtoken(NGROK_TOKEN);
    // url tunel para localhost:80
    const url = await ngrok.connect();
    // url de conexão com o serviço repl.it
    let { URL_SERVER } = process.env;

    console.log(`${url}/getPointsInPolygon`)
    console.log(`${url}/getDisponibilidade`)
    // enviar url tunel sempre atualizada
    const body = { url: url };

    const response = await fetch(`${URL_SERVER}/setLink`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    // resposta do servidor apenas para confirmações
    const data = await response.json();

    console.log(data);

})();
*/


app.get('/getPointsInPolygon', function (req, res) {
    // mudar para post e assim enviar um polígono para o servidor repl.it

    //conexão com o banco
    sql.connect(config, function (err) {

        if (err) console.log(err);

        // criar requirisão
        var request = new sql.Request();
        // polígono  que ser enviado no body
        let polygon = 'POLYGON((-47.73739483545068 -15.724018294609081,-47.50118878076318 -15.724018294609081 ,-47.502562071778804 -15.877300760051735 ,-47.74014141748193 -15.869375206281301,-47.73739483545068 -15.724018294609081))';
        // requisição
        request.query(`DECLARE @g geometry;SET @g = geometry::STGeomFromText('${polygon}', 4674);SELECT * FROM [SRH].[gisadmin].[INTERFERENCIA] WHERE @g.STContains(SHAPE) = 1`, function (err, recordset) {
            if (err) console.log(err)
            res.send(JSON.stringify(recordset.recordsets));
        });
    });
});

app.get('/getDisponibilidade', function (req, res) {
    console.log('getDisponibilidade')
    //conexão com o banco
    sql.connect(config, function (err) {

        if (err) console.log(err);

        // criar requirisão
        var request = new sql.Request();
        // polígono  que ser enviado no body
        let _dis_tub_query = dis_tub_query;
        // requisição
        request.query(_dis_tub_query, function (err, recordset) {
            if (err) console.log(err)
            console.log(recordset)
            res.send(JSON.stringify(recordset.recordsets));
        });
    });
})


async function selectFinalidades() {

    //conexão com o banco
    sql.connect(config, function (err) {

        if (err) console.log(err);

        // criar requirisão
        var request = new sql.Request();
        // polígono  que ser enviado no body
        // requisição
        let query = `
        SELECT (
            SELECT *
            FROM [SRH].[gisadmin].[FINALIDADE] AS FIN
            JOIN
            [SRH].[gisadmin].[TIPO_FINALIDADE] AS TF
            on
            TF.ID_TIPO_FINALIDADE = FIN.ID_TIPO_FINALIDADE
            WHERE ID_INTERFERENCIA = 1124
            FOR XML  PATH('FINALIDADE'), ROOT('FINALIDADES')
            ) AS FINALIDADES
        `

        //console.log(query)
        request.query(query, function (err, recordset) {
            if (err) console.log(err)

            let { FINALIDADES } = recordset.recordsets[0][0];

            console.log(FINALIDADES);

            xml2js.parseString(FINALIDADES, (err, result) => {
                if (err) {
                    throw err
                }
                const json = JSON.stringify(result, null, 4)

                console.log(json)
            })
        });
    });
}
/**
 * Inserir pontos de outorga no banco de dados postgress - supabase
 */

let sup_url = 'https://njs-pg-sb-drainage.ueredeveloper.repl.co'
async function insertPoints() {
    sql.connect(config, function (err) {

        if (err) console.log(err);

        // criar requirisão
        var request = new sql.Request();

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        function saveEveryHundred() {
            let begin = new Date();
            let time = 3000;
            for (let i = 0; i <= 15000; i = i + 100) {

                sleep(time).then(() => {
                    let ii = i + 100
                    let now = new Date()
                    console.log('-----', i, ii, begin.getSeconds(), now.getSeconds());

                    let _dis_tub_query = dis_tub_query(i, ii);
                    // requisição

                    request.query(_dis_tub_query, async function (err, recordset) {
                        if (err) console.log(err);

                        let _outorgas = recordset.recordsets[0].map((outorga, index) => {

                            console.log(outorga.int_id, index)
                            // conversão para o formato postgres
                            let { x, y } = outorga.int_shape.points[0]
                            outorga.int_shape = `POINT(${x} ${y})`;
                            if (outorga.fin_finalidade != null) {


                                // conversão xml to json
                                xml2js.parseString(
                                    outorga.fin_finalidade,
                                    { explicitRoot: false, normalizeTags: true }, (err, result) => {
                                        if (err) {
                                            throw err
                                        }
                                        outorga.fin_finalidade = result
                                    });
                            }
                            if (outorga.dt_demanda != null) {
                                // conversão xml to json
                                xml2js.parseString(outorga.dt_demanda,
                                    { explicitRoot: false, normalizeTags: true }, (err, result) => {
                                        if (err) {
                                            throw err
                                        }
                                        outorga.dt_demanda = result
                                    });
                            }

                            return outorga;
                        })
                        const { data, error } = await supabase
                            .from('outorgas')
                            .upsert(_outorgas,
                                { onConflict: 'int_id' })
                            .select()
                        if (error) {
                            console.log(JSON.stringify({ message: error }))
                        } else {
                            console.log(JSON.stringify({ message: 'ok' }))
                        }
                    });

                });
                time = time + 3000

            }
        }

        saveEveryHundred();

    });
}
//insertPoints()

async function upsertSupPoints () {
    sql.connect(config, function (err) {

        if (err) console.log(err);

        // criar requirisão
        var request = new sql.Request();

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        function saveEveryHundred() {
            let begin = new Date();
            let time = 3000;
            for (let i = 600; i <= 603; i = i + 1) {

                sleep(time).then(() => {
                    let ii = i + 100
                    let now = new Date()
                    console.log('-----', i, ii, begin.getSeconds(), now.getSeconds());

                    let _dis_sup_query = dis_sup_query(i, ii);
                    // requisição

                    request.query(_dis_sup_query, async function (err, recordset) {
                        if (err) console.log(err);

                        let _outorgas = recordset.recordsets[0].map((outorga, index) => {

                            console.log(outorga.int_id, index)
                            // conversão para o formato postgres
                            let { x, y } = outorga.int_shape.points[0]
                            outorga.int_shape = `POINT(${x} ${y})`;
                            if (outorga.fin_finalidade != null) {


                                // conversão xml to json
                                xml2js.parseString(
                                    outorga.fin_finalidade,
                                    { explicitRoot: false, normalizeTags: true }, (err, result) => {
                                        if (err) {
                                            throw err
                                        }
                                        outorga.fin_finalidade = result
                                    });
                            }
                            if (outorga.dt_demanda != null) {
                                // conversão xml to json
                                xml2js.parseString(outorga.dt_demanda,
                                    { explicitRoot: false, normalizeTags: true }, (err, result) => {
                                        if (err) {
                                            throw err
                                        }
                                        outorga.dt_demanda = result
                                    });
                            }

                            console.log(outorga)

                            return outorga;
                        })
                        const { data, error } = await supabase
                            .from('superficial')
                            .upsert(_outorgas,
                                { onConflict: 'int_id' })
                            .select()
                        if (error) {
                            console.log(JSON.stringify({ message: error }))
                        } else {
                            console.log(JSON.stringify({ message: 'ok' }))
                        }
                    });

                });
                time = time + 3000

            }
        }

        saveEveryHundred();

    });
}
upsertSupPoints()
//selectFinalidades()

/*
app.listen(80, function () {
    console.log('Server is running..');
});*/
