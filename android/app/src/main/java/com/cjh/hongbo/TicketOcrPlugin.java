package com.cjh.hongbo;

import android.graphics.Rect;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 彩票票面文字识别：用 Google ML Kit 中文模型在手机上离线识别，照片不上传。
 * 输入照片路径，返回按行排好的文字。
 */
@CapacitorPlugin(name = "TicketOcr")
public class TicketOcrPlugin extends Plugin {

    private TextRecognizer recognizer;

    private TextRecognizer recognizer() {
        if (recognizer == null) {
            recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
        }
        return recognizer;
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("没有照片路径");
            return;
        }
        InputImage image;
        try {
            Uri uri = path.startsWith("/") ? Uri.parse("file://" + path) : Uri.parse(path);
            image = InputImage.fromFilePath(getContext(), uri);
        } catch (Exception e) {
            call.reject("读不了这张照片：" + e.getMessage());
            return;
        }
        recognizer().process(image)
            .addOnSuccessListener(result -> {
                // 按从上到下、从左到右排好每一行，票面号码的顺序才对
                List<Text.Line> lines = new ArrayList<>();
                for (Text.TextBlock block : result.getTextBlocks()) {
                    lines.addAll(block.getLines());
                }
                Collections.sort(lines, (a, b) -> {
                    Rect ra = a.getBoundingBox(), rb = b.getBoundingBox();
                    if (ra == null || rb == null) return 0;
                    int ha = Math.max(1, ra.height());
                    if (Math.abs(ra.centerY() - rb.centerY()) < ha * 0.6) return Integer.compare(ra.left, rb.left);
                    return Integer.compare(ra.centerY(), rb.centerY());
                });
                // 同一水平线上的片段合成一行
                StringBuilder text = new StringBuilder();
                JSArray arr = new JSArray();
                Rect prev = null;
                for (Text.Line line : lines) {
                    Rect r = line.getBoundingBox();
                    if (prev != null && r != null && Math.abs(r.centerY() - prev.centerY()) < Math.max(1, prev.height()) * 0.6) {
                        text.append(' ');
                    } else if (text.length() > 0) {
                        text.append('\n');
                    }
                    text.append(line.getText());
                    JSObject o = new JSObject();
                    o.put("text", line.getText());
                    if (r != null) {
                        o.put("x", r.left);
                        o.put("y", r.top);
                        o.put("w", r.width());
                        o.put("h", r.height());
                    }
                    arr.put(o);
                    if (r != null) prev = r;
                }
                JSObject ret = new JSObject();
                ret.put("text", text.toString());
                ret.put("lines", arr);
                call.resolve(ret);
            })
            .addOnFailureListener(e -> call.reject("识别失败：" + e.getMessage()));
    }
}
