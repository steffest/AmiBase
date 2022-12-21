import BaseImage from "./second.js";

export default function test(app){
    console.log("test here")
    console.log(app);
    app.setContent("Loaded");
    BaseImage().do();
};
