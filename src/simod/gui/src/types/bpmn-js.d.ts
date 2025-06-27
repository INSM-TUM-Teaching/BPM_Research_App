declare module "bpmn-js/lib/Modeler" {
  export default class BpmnModeler {
    constructor(opts?: any);
    importXML(xml: string): Promise<any>;
    saveXML(opts?: any): Promise<{ xml: string }>;
    saveSVG(opts?: any): Promise<{ svg: string }>;
    destroy(): void;
  }
}
