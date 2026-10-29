const sampleDesc = "IMAGO";
const prefix = sampleDesc.slice(0, 14); // "IMAGO"
const desc = "IMAGO";

const prefixOk =
      desc === sampleDesc ||
      (prefix.length >= 8 &&
        (desc.startsWith(prefix) || sampleDesc.startsWith(desc.slice(0, 14))));
console.log(prefixOk);
