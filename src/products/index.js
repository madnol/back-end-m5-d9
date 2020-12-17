const express = require("express");
const fs = require("fs");
const path = require("path");
const uniqid = require("uniqid");
const reviewsRoutes = require("../reviews");
const { begin } = require("xmlbuilder");
const axios = require("axios");
const { parseString } = require("xml2js");
const { promisify } = require("util");

const { createReadStream } = require("fs-extra");
const { Transform } = require("json2csv");
const { pipeline } = require("stream");

const { readDB } = require("../lib/utilities");

const router = express.Router();

router.use("/reviews", reviewsRoutes);

const productsFilePath = path.join(__dirname, "products.json");

const readDatabase = () => {
  const fileAsBuffer = fs.readFileSync(productsFilePath);
  const fileAsAString = fileAsBuffer.toString();
  const productsArray = JSON.parse(fileAsAString);
  return productsArray;
};

router.get("/", (req, res, next) => {
  try {
    const productsArray = readDatabase();

    res.send(productsArray);
  } catch (err) {
    err.httpStatusCode = 404;
    next(err);
  }
});

router.get("/:id", (req, res, next) => {
  try {
    const productsArray = readDatabase();
    const singleProduct = productsArray.filter(
      product => product._id === req.params.id
    );

    res.status(201).send(singleProduct);
  } catch (err) {
    err.httpStatusCode = 404;
    next(err);
  }
});

router.post("/", (req, res, next) => {
  try {
    const newProduct = req.body;
    const productsArray = readDatabase();

    newProduct._id = uniqid();
    newProduct.createdAt = new Date();
    newProduct.updatedAt = new Date();
    productsArray.push(newProduct);
    fs.writeFileSync(productsFilePath, JSON.stringify(productsArray));
    res.status(201).send(newProduct);
  } catch (err) {
    err.httpStatusCode = 404;
    next(err);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const productsArray = readDatabase();
    const singleProduct = productsArray.filter(
      product => product._id === req.params.id
    );
    const filteredArray = productsArray.filter(
      product => product._id !== req.params.id
    );

    const editedProduct = req.body;
    editedProduct._id = singleProduct[0]._id;
    editedProduct.createdAt = singleProduct[0].createdAt;
    editedProduct.updatedAt = new Date();
    filteredArray.push(editedProduct);

    fs.writeFileSync(productsFilePath, JSON.stringify(filteredArray));
    res.status(201).send(editedProduct);
  } catch (err) {
    err.httpStatusCode = 404;
    next(err);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const productsArray = readDatabase();
    const singleProduct = productsArray.filter(
      product => product._id === req.params.id
    );
    const filteredArray = productsArray.filter(
      product => product._id !== req.params.id
    );

    const deletedProduct = req.body;
    fs.writeFileSync(productsFilePath, JSON.stringify(filteredArray));
    res.status(201).send(filteredArray);
  } catch (err) {
    err.httpStatusCode = 404;
    next(err);
  }
});

router.get("/:id/reviews", async (req, res, next) => {
  try {
    const reviewDataBase = await readDB(
      path.join(__dirname, "../reviews/reviews.json")
    );
    if (reviewDataBase.length > 0) {
      const productReviews = reviewDataBase.filter(
        review => review.productID === req.params.id
      );
      res.status(201).send(productReviews);
    } else {
      const err = {};
      err.httpStatusCode = 404;
      err.message = "The review databse is empty!";
    }
  } catch (err) {
    err.httpStatusCode = 404;
    next(err);
  }
});

router.get("/sum/TwoPrices", async (req, res, next) => {
  try {
    //WE NEED TO ADD TWO PRICES USING AN EXTENAL WEBSITE THAT ONLY ACCEPTS XMLS
    //A) GET PRICES FROM THE IDS GIVEN IN REQ.QUERY
    //B) CREATE XML VARIABLE ACCORDING TO WEBSITES REQUEST STRUCTURE
    //C) SEND REQUEST TO WEBSITE VIA AXIOS
    //D) TURN RESULT TO JSON, SEND AS RESPONSE TO CLIENT

    //AAAAAAAAAAAAAAAAAAAAA

    const { id1, id2 } = req.query; //http://localhost:6969/products?id1={a products id}&id2={a diff products id}

    const productDB = await readDatabase(); //GETTING PRODUCT DATABASE

    const product1 = productDB.find(product => product._id === id1);
    const product2 = productDB.find(product => product._id === id2);

    //BBBBBBBBBBBBBBBBBBBBBB

    const xmlBodyThatWeAreGonnaSendToExternalWebsite = begin()
      .ele("soap:Envelope", {
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
        "xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/",
      })
      .ele("soap:Body")
      .ele("Add", { xmlns: "http://tempuri.org/" })
      .ele("intA")
      .text(parseInt(product1.price))
      .up()
      .ele("intB")
      .text(parseInt(product2.price))
      .end();

    //CCCCCCCCCCCCCCCCCCCCCC

    const response = await axios({
      method: "post",
      url: "http://www.dneonline.com/calculator.asmx?op=Add",
      data: xmlBodyThatWeAreGonnaSendToExternalWebsite,
      headers: { "Content-type": "text/xml" },
    });

    console.log(response); //THIS RESPONSE IS RETURNED IN A STRING

    //DDDDDDDDDDDDDDDDDDDD

    const asyncParser = promisify(parseString);
    //parseString: TAKES AN XML STRING AND TURNS IT INTO A JSON
    //promisify: MAKES parseString A PROMISE SO I CAN WORK ASYNCHRONOUSLY

    const xml = response.data; //GETTING RESPONSE VALUE OUT OF A PROP/KEY PAIR OF AN OBJECT

    const parsedJS = await asyncParser(xml); //ASYNCHORNOUSLY TURNS STRING INTO JS

    //PARSED JSON LOOKS LIKE THIS:{
    //   "soap:Envelope": {
    //     "$": {
    //         "xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/",
    //         "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    //         "xmlns:xsd": "http://www.w3.org/2001/XMLSchema"
    //     },
    //     "soap:Body": [
    //         {
    //             "AddResponse": [
    //                 {
    //                     "$": {
    //                         "xmlns": "http://tempuri.org/"
    //                     },
    //                     "AddResult": [
    //                         "103"
    //                     ]
    //                 }
    //             ]
    //         }
    //     ]
    // }
    // }
    // SO WE NEED TO USE parsedJS["soap:Envelope"]["soap:Body"][0]["AddResponse"][0]["AddResult"][0];
    // TO GET JUST THE ADDED RESULT VALUE

    const addedResult =
      parsedJS["soap:Envelope"]["soap:Body"][0]["AddResponse"][0][
        "AddResult"
      ][0];

    res.send(addedResult);
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.get("/export/CSV", async (req, res, next) => {
  try {
    const source = createReadStream(productsFilePath); // DEFINES PATH AS THE FILE WE'RE GONNA COPY

    const transformJsonIntoCsv = new Transform({
      fields: [
        "name",
        "description",
        "brand",
        "price",
        "category",
        "_id",
        "image",
      ],
    });

    res.setHeader("Content-Disposition", "attachment; filename=products.csv");

    pipeline(source, transformJsonIntoCsv, res, err => {
      if (err) {
        console.log(err);
        next(err);
      } else {
        console.log("fucken done");
      }
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

module.exports = router;
