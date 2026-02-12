

const getTag1 = GetSingleHistoricalTag("PlantA.Pump-01.pressure", "start ts", "end ts", "time bucket"); // return [{ts,val}]

const getTags = GetMultipleHistoricalTag([
    "PlantA.Pump-01.pressure",
    "PlantA.Pump-02.pressure",
    "PlantA.Pump-03.pressure",
], "start ts", "end ts", "time bucket"); // return [{ts,val}]

const paperLength = GetSingleTag("PlantB.OffsetPrinter.rollEncoder"); // return val
const paperWidth = GetSingleTag("PlantB.OffsetPrinter.productLength"); // return val
const productCount = paperLength / paperWidth; // calculate product count

const tags = GetMultipleTag([
    "PlantB.OffsetPrinter.operatorName",
    "PlantB.OffsetPrinter.speed",
]); // return {tagName: val}

if (tags["PlantB.OffsetPrinter.speed"] > 100) {
    // do something
    SetSingleTag("PlantB.OffsetPrinter.status", "Over Speed");
}