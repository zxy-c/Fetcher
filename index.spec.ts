import Fetcher from "./index";
describe("CancelablePromise usage suite", () => {
    it("get", (done) => {
        new Fetcher("https://dog.ceo/api").get("breeds/image/random").then(res=>{
            console.debug(res)
            done()
        })
    });
});
