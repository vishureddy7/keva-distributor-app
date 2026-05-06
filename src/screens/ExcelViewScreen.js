// ─────────────────────────────────────────────
//  ExcelViewScreen.js
//  Generates Excel from Firebase data on demand.
//  Options:
//    1. Save to Downloads (Android SAF / iOS Files)
//    2. Share via WhatsApp, email, Drive, etc.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing    from 'expo-sharing';

import { generateAndSaveExcel } from '../services/firebaseService';
import { COLORS }               from '../utils/constants';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FILE_NAME = 'keva_stock.xlsx';

/**
 * Saves a base64-encoded xlsx to the device Downloads folder.
 *
 * Android — uses StorageAccessFramework (SAF) so the file appears in
 *   the Downloads folder via the system file manager.
 * iOS — opens the "Save to Files" sheet via expo-sharing.
 *
 * Returns: { saved: true, uri } | { saved: false, reason }
 */
async function saveToDownloads(base64) {
  if (Platform.OS === 'ios') {
    // On iOS the share sheet is how users save to Files.
    // We write to a temp path first then share it.
    const tempPath = `${FileSystem.cacheDirectory}${FILE_NAME}`;
    await FileSystem.writeAsStringAsync(tempPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await Sharing.shareAsync(tempPath, {
      mimeType: MIME,
      dialogTitle: 'Save to Files',
      UTI: 'com.microsoft.excel.xlsx',
    });
    return { saved: true, uri: tempPath };
  }

  // ── Android: SAF ─────────────────────────
  try {
    // Ask user to pick a directory (navigate to Downloads)
    const perm =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (!perm.granted) {
      return { saved: false, reason: 'Permission denied — no folder selected.' };
    }

    // Create the file inside the chosen directory
    const fileUri =
      await FileSystem.StorageAccessFramework.createFileAsync(
        perm.directoryUri,
        FILE_NAME,
        MIME,
      );

    // Write base64 content
    await FileSystem.StorageAccessFramework.writeAsStringAsync(
      fileUri,
      base64,
      { encoding: FileSystem.EncodingType.Base64 },
    );

    return { saved: true, uri: fileUri };
  } catch (err) {
    return { saved: false, reason: err.message || 'Could not save to selected folder.' };
  }
}

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function ExcelViewScreen() {
  const [generating, setGenerating] = useState(false);
  const [action,     setAction]     = useState(null); // 'save' | 'share'

  // ── Core: generate Excel ──────────────────
  async function getExcelData() {
    const result = await generateAndSaveExcel();
    // generateAndSaveExcel returns { filePath, base64 }
    return result;
  }

  // ── Save to Downloads ─────────────────────
  const handleSave = async () => {
    try {
      setGenerating(true);
      setAction('save');

      const { filePath, base64 } = await getExcelData();

      const result = await saveToDownloads(base64);

      if (result.saved) {
        Alert.alert(
          '✅ Saved!',
          Platform.OS === 'ios'
            ? 'Use the share sheet to save the file to your Files app.'
            : 'Excel file saved to the folder you selected.\n\nYou can find it in your phone\'s file manager.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert(
          'Not Saved',
          result.reason || 'The file was not saved.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Failed', error.message || 'Could not generate or save the Excel file.');
    } finally {
      setGenerating(false);
      setAction(null);
    }
  };

  // ── Share via share sheet ─────────────────
  const handleShare = async () => {
    try {
      setGenerating(true);
      setAction('share');

      const { filePath } = await getExcelData();

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
        return;
      }

      await Sharing.shareAsync(filePath, {
        mimeType: MIME,
        dialogTitle: 'Share Keva Stock Data',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', error.message || 'Could not generate the Excel file.');
    } finally {
      setGenerating(false);
      setAction(null);
    }
  };

  const isBusy = generating;

  return (
    <ScrollView
      contentContainerStyle={styles.root}
      alwaysBounceVertical={false}
    >

      {/* ── Header ────────────────────────── */}
      <View style={styles.headerBox}>
        <Text style={styles.headerIcon}>📊</Text>
        <Text style={styles.headerTitle}>Export to Excel</Text>
        <Text style={styles.headerSubtitle}>
          Generate a fresh Excel file from the live cloud database.
        </Text>
      </View>

      {/* ── How it works ──────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What's in the file?</Text>
        <StepRow n="1" text="Total Stock sheet — current inventory snapshot" />
        <StepRow n="2" text="One sheet per product — full transaction history" />
        <StepRow n="3" text="Every sale and restock ever recorded" />
        <View style={styles.infoStrip}>
          <Text style={styles.infoIcon}>☁️</Text>
          <Text style={styles.infoText}>
            Data is pulled live from Firebase — always up to date.
          </Text>
        </View>
      </View>

      {/* ── Action buttons ────────────────── */}
      <View style={styles.actionSection}>

        {/* Save to Downloads */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.saveBtn, isBusy && styles.actionBtnDisabled]}
          onPress={handleSave}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {isBusy && action === 'save' ? (
            <>
              <ActivityIndicator size="small" color={COLORS.surface} />
              <Text style={styles.actionBtnText}>Saving…</Text>
            </>
          ) : (
            <>
              <Text style={styles.actionBtnIcon}>💾</Text>
              <View style={styles.actionBtnTextGroup}>
                <Text style={styles.actionBtnText}>
                  {Platform.OS === 'ios' ? 'Save to Files' : 'Save to Downloads'}
                </Text>
                <Text style={styles.actionBtnSub}>
                  {Platform.OS === 'ios'
                    ? 'Opens save-to-Files sheet'
                    : 'Choose a folder (e.g. Downloads)'}
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.shareBtn, isBusy && styles.actionBtnDisabled]}
          onPress={handleShare}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {isBusy && action === 'share' ? (
            <>
              <ActivityIndicator size="small" color={COLORS.surface} />
              <Text style={styles.actionBtnText}>Generating…</Text>
            </>
          ) : (
            <>
              <Text style={styles.actionBtnIcon}>📤</Text>
              <View style={styles.actionBtnTextGroup}>
                <Text style={styles.actionBtnText}>Share / Send</Text>
                <Text style={styles.actionBtnSub}>
                  WhatsApp, Email, Google Drive, etc.
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.actionHint}>
          {Platform.OS === 'android'
            ? 'For Downloads: tap "Save to Downloads", navigate to your Downloads folder, then tap "Use this folder".'
            : 'For Files: tap "Save to Files" and choose a location in the sheet that opens.'}
        </Text>
      </View>

    </ScrollView>
  );
}

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function StepRow({ n, text }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
    alignItems: 'center',
  },

  // ── Header ────────────────────────────────
  headerBox: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  headerIcon:     { fontSize: 54, marginBottom: 12 },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: '#212121', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: '#757575', textAlign: 'center', lineHeight: 20 },

  // ── Info card ─────────────────────────────
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 10,
  },
  stepRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  stepNum:  { fontSize: 12, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1, fontSize: 14, color: '#212121', lineHeight: 20 },

  infoStrip: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 10,
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 18 },

  // ── Action buttons ────────────────────────
  actionSection: { width: '100%', alignItems: 'stretch', gap: 12 },

  actionBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    gap: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  actionBtnDisabled: { opacity: 0.65, shadowOpacity: 0, elevation: 0 },

  saveBtn: {
    backgroundColor: '#00796B',   // teal — "save" action
    shadowColor: '#00796B',
  },
  shareBtn: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
  },

  actionBtnIcon:      { fontSize: 22 },
  actionBtnTextGroup: { flex: 1 },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  actionBtnSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
  },

  actionHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});