import * as Enzyme from "enzyme";
import * as Adapter from 'enzyme-adapter-react-16';
import { JSDOM } from 'jsdom'

export function setupJSDomEnv() {
    function copyProps(src, target) {
        const props = Object.getOwnPropertyNames(src)
            .filter(prop => typeof target[prop] === 'undefined')
            .reduce((result, prop) => ({
                ...result,
                [prop]: Object.getOwnPropertyDescriptor(src, prop),
            }), {});
        Object.defineProperties(target, props);
    }
    const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
        url: "http://localhost"
    });
    (global as any).window = jsdom.window;
    (global as any).document = jsdom.window.document;
    (global as any).navigator = {
        userAgent: 'node.js'
    }
    copyProps(jsdom.window, global);

    Enzyme.configure({ adapter: new Adapter() });
}