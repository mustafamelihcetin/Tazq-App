import { registerWebModule, NativeModule } from 'expo';

class TazqWidgetBridgeModule extends NativeModule<{}> {}

export default registerWebModule(TazqWidgetBridgeModule, 'TazqWidgetBridgeModule');
