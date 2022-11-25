const { application } = require('express');
var express = require('express');
var app = express();
require('dotenv').config();

const { ADASA_DATABASE, ADASA_USERNAME, ADASA_PASSWORD, ADASA_HOST } = process.env;

app.get('/getPointsInPolygon', function (req, res) {
   
    var sql = require("mssql");

    // config for your database
    var config = {
        user: ADASA_USERNAME,
        password: ADASA_PASSWORD,
        server: ADASA_HOST, 
        database: ADASA_DATABASE,
        trustServerCertificate: true,
    };

    // connect to your database
    sql.connect(config, function (err) {
    
        if (err) console.log(err);

        // create Request object
        var request = new sql.Request();

        let polygon = 'POLYGON((-47.73739483545068 -15.724018294609081,-47.50118878076318 -15.724018294609081 ,-47.502562071778804 -15.877300760051735 ,-47.74014141748193 -15.869375206281301,-47.73739483545068 -15.724018294609081))';
           
        // query to the database and get the records
        //request.query('select * from [gisadmin].[INTERFERENCIA] where ID_INTERFERENCIA < 2', function (err, recordset) {
        request.query(`DECLARE @g geometry;SET @g = geometry::STGeomFromText('${polygon}', 4674);SELECT * FROM [SRH].[gisadmin].[INTERFERENCIA] WHERE @g.STContains(SHAPE) = 1`, function (err, recordset) {    
            if (err) console.log(err)

            // send records as a response
            res.send(recordset);
            
        });
    });
});

app.listen(8080, function () {
    console.log('Server is running..');
});
