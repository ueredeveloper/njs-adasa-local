const { application } = require('express');
const express = require('express');
const ngrok = require('ngrok');
const xml2js = require('xml2js');
const { dis_tub_query } = require('./services/queries')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const sql = require("mssql");
require('dotenv').config();

const app = express();

const { ADASA_DATABASE, ADASA_USERNAME, ADASA_PASSWORD, ADASA_HOST } = process.env;
// configurações do banco
const config = {
    user: ADASA_USERNAME,
    password: ADASA_PASSWORD,
    server: ADASA_HOST,
    database: ADASA_DATABASE,
    trustServerCertificate: true,
};


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
        // polígono  que ser enviado no body
        let _dis_tub_query = dis_tub_query();
        // requisição
        request.query(_dis_tub_query, async function (err, recordset) {
            if (err) console.log('------------->', err)
            //let {fin_finalidade} = recordset.recordsets[0][0]
            // console.log(PROCESSO)

            // transformar o xml lower case aqui, antes de enviar

            const response = await fetch(`${sup_url}/insertPoints`, {
                method: 'POST',
                body: JSON.stringify(recordset.recordsets[0]),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            console.log(data)
            //res.send(JSON.stringify(data))
            //res.send(JSON.stringify(recordset.recordsets));
        });
    });
}
insertPoints()
//selectFinalidades()

app.listen(80, function () {
    console.log('Server is running..');
});
