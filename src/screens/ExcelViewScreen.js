// ─────────────────────────────────────────────
//  ExcelViewScreen.js
//  Generates Excel from Firebase data on demand
//  and shares it via the device share sheet.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import * as Sharing from 'expo-sharing';

import { generateAndSaveExcel } from '../services/firebaseService';
import { COLORS } from '../utils/constants';

export default function ExcelViewScreen() {
  const [generating, setGenerating] = useState(false);

  const handleExport = async () => {
    try {
      setGenerating(true);
      const filePath = await generateAndSaveExcel();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
        return;
      }
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Keva Stock Data',
        UTI: 'com.microsoft.excel.xls',
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error.message || 'Could not generate the Excel file.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.root} alwaysBounceVertical={false}>

      <View style={styles.headerBox}>
        <Text style={styles.headerIcon}>📊</Text>
        <Text style={styles.headerTitle}>Export to Excel</Text>
        <Text style={styles.headerSubtitle}>
          Generate a fresh Excel file from the live cloud database and share it instantly.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How it works</Text>
        <StepRow n="1" text="Tap the export button below" />
        <StepRow n="2" text="App downloads all live data from Firebase" />
        <StepRow n="3" text="Excel is generated — Total Stock sheet + one sheet per product" />
        <StepRow n="4" text="Share via WhatsApp, email, Google Drive — your choice" />
        <View style={styles.infoStrip}>
          <Text style={styles.infoIcon}>☁️</Text>
          <Text style={styles.infoText}>
            Data is stored in Firebase cloud. Both you and your dad always see the same live data.
          </Text>
        </View>
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.exportBtn, generating && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <>
              <ActivityIndicator size="small" color={COLORS.surface} />
              <Text style={styles.exportBtnText}>Generating Excel…</Text>
            </>
          ) : (
            <>
              <Text style={styles.exportBtnIcon}>📤</Text>
              <Text style={styles.exportBtnText}>Generate & Share Excel</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.actionHint}>
          The file includes all transaction history — every sale and restock ever recorded.
        </Text>
      </View>

    </ScrollView>
  );
}

function StepRow({ n, text }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}><Text style={styles.stepNum}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, backgroundColor: '#F5F7FA', padding: 20, alignItems: 'center' },
  headerBox: { alignItems: 'center', marginTop: 20, marginBottom: 30, paddingHorizontal: 10 },
  headerIcon:     { fontSize: 54, marginBottom: 12 },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: '#212121', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: '#757575', textAlign: 'center', lineHeight: 20 },
  card: {
    width: '100%', backgroundColor: '#fff', borderRadius: 14,
    padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTitle: {
    fontSize: 16, fontWeight: '700', color: '#212121', marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 10,
  },
  stepRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  stepNum:  { fontSize: 12, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1, fontSize: 14, color: '#212121', lineHeight: 20 },
  infoStrip: {
    flexDirection: 'row', backgroundColor: '#E3F2FD',
    padding: 12, borderRadius: 8, marginTop: 8, gap: 10,
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 18 },
  actionSection: { width: '100%', alignItems: 'center' },
  exportBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary, width: '100%',
    paddingVertical: 16, borderRadius: 12, justifyContent: 'center',
    alignItems: 'center', gap: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  exportBtnDisabled: { opacity: 0.7 },
  exportBtnIcon: { fontSize: 20 },
  exportBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  actionHint: {
    marginTop: 14, fontSize: 13, color: '#757575',
    textAlign: 'center', lineHeight: 19, paddingHorizontal: 20,
  },
});
