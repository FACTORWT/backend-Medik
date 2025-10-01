const { publicPics } = require("../config");

exports.header = `<head>
                <meta content="text/html; charset=utf-8" http-equiv="Content-Type">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link
                    href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap"
                    rel="stylesheet">
                </head>`;

exports.footer = `
                <div style="text-align: center; margin-top: 40px;">
                    <div style="margin-right: 20px; display: inline-block; width:25px; height:25px"><img
                            style="width: 100%; height:100%; object-fit:cover" src="${publicPics}/instagram.png" alt=""></div>
                    <div style="margin-right: 20px; display: inline-block; width:25px; height:25px"><img
                            style="width: 100%; height:100%; object-fit:cover" src="${publicPics}/twitter.png" alt=""></div>
                    <div style="display: inline-block; width:25px; height:25px"><img
                            style="width: 100%; height:100%; object-fit:cover" src="${publicPics}/facebook.png" alt=""></div>
                </div>`;
