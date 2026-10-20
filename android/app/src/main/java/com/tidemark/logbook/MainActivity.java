package com.tidemark.logbook;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TideMarkStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
