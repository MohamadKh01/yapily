import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';

// Use your computer's local Wi-Fi IP or your ngrok URL for API calls
const API_BASE_URL = 'http://192.168.0.137:3000';
// If testing on a physical phone, replace 127.0.0.1 with your PC's Wi-Fi IP (e.g., http://192.168.1.15:3000)

interface Institution {
  id: string;
  name: string;
}

interface ConsentInfo {
  authorizedAt?: string;
  expiresAt?: string;
  reconfirmBy?: string;
}

interface AccountItem {
  id: string;
  accountType?: string;
  currency?: string;
  accountNames?: Array<{ name?: string }>;
}

interface TransactionItem {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description?: string;
  status?: string;
}

export default function App(): React.JSX.Element {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentConsentId, setCurrentConsentId] = useState<string | null>(null);
  const [consentInfo, setConsentInfo] = useState<ConsentInfo | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  // Transactions & consent token state
  const [consentToken, setConsentToken] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);

  // Webview Modal state
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/institutions`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const json = await res.json();
      setInstitutions(json.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg('Failed loading banks: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const initiateConsent = async (institutionId: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ institutionId }),
      });

      const json = await res.json();

      if (json.data && json.data.authorisationUrl) {
        setCurrentConsentId(json.data.id);
        // Open the bank authorization screen inside the in-app WebView
        setAuthUrl(json.data.authorisationUrl);
      } else {
        setErrorMsg('Authorization failed: ' + JSON.stringify(json));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg('Error: ' + message);
    } finally {
      setLoading(false);
    }
  };

  // Intercept the redirect to https://auth.yapily.com/?consent=...
  const handleNavigationStateChange = (navState: { url: string }) => {
    const url = navState.url;

    if (url.includes('consent=')) {
      // Extract the consent token from the query string
      const queryString = url.split('?')[1] || '';
      const params = new URLSearchParams(queryString);
      const token = params.get('consent') || params.get('consentToken');

      if (token) {
        // Close the WebView immediately
        setAuthUrl(null);
        setConsentToken(token);
        fetchConsentData(token);

      }
    }
  };

  const fetchConsentData = async (token: string) => {
    setLoading(true);
    try {
      // 1. Fetch Account Information
      const accRes = await fetch(`${API_BASE_URL}/api/accounts`, {
        headers: {
          consent: token,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const accJson = await accRes.json();
      setAccounts(accJson.data || []);

      // 2. Fetch Consent Lease Duration
      if (currentConsentId) {
        const cRes = await fetch(`${API_BASE_URL}/api/consents/${currentConsentId}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        const cJson = await cRes.json();
        setConsentInfo(cJson.data || null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg('Failed fetching data: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setAccounts(null);
    setConsentInfo(null);
    setConsentToken(null);
    setCurrentConsentId(null);
    setSelectedAccountId(null);
    setTransactions([]);
    setErrorMsg('');
  };

  // Fetch transactions when an account card is clicked
  const handleAccountClick = async (accountId: string) => {
    if (!consentToken) return;

    setSelectedAccountId(accountId);
    setLoadingTx(true);
    setTransactions([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/accounts/${accountId}/transactions`, {
        headers: {
          consent: consentToken,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const json = await res.json();
      setTransactions(json.data || []);
    } catch (err) {
      console.error('Failed fetching transactions', err);
    } finally {
      setLoadingTx(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Open Banking AIS</Text>
        <Text style={styles.subtitle}>Lab 3 — Mobile Client</Text>

        {loading && <ActivityIndicator size="large" color="#0284c7" style={{ marginVertical: 20 }} />}
        {errorMsg !== '' && <Text style={styles.error}>{errorMsg}</Text>}

        {/* Step 1: Bank List */}
        {!accounts && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Select Institution</Text>
            {institutions.map((bank: Institution) => (
              <View key={bank.id} style={styles.bankRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankName}>{bank.name}</Text>
                  <Text style={styles.bankId}>{bank.id}</Text>
                </View>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => initiateConsent(bank.id)}>
                  <Text style={styles.buttonText}>Connect</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Step 2: Consent Lease Details */}
        {consentInfo && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Consent Duration (Lease)</Text>
            <Text style={styles.textRow}>• Authorized At: {consentInfo.authorizedAt || 'N/A'}</Text>
            <Text style={styles.textRow}>• Expires At: {consentInfo.expiresAt || 'N/A'}</Text>
            <Text style={styles.textRow}>• Reconfirm By: {consentInfo.reconfirmBy || 'N/A'}</Text>
          </View>
        )}

        {/* Step 3: Account Information List */}
        {accounts && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.cardHeader, { marginBottom: 0 }]}>Accounts</Text>
              <TouchableOpacity
                style={styles.switchBankButton}
                onPress={handleDisconnect}>
                <Text style={styles.switchBankButtonText}>Switch Bank</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>Tap an account to view transfers</Text>

            {accounts.map((acc: AccountItem) => (
              <TouchableOpacity
                key={acc.id}
                style={styles.accountBox}
                onPress={() => handleAccountClick(acc.id)}>
                <Text style={styles.bankName}>{acc.accountNames?.[0]?.name || 'Account'}</Text>
                <Text style={styles.textRow}>ID: {acc.id}</Text>
                <Text style={styles.textRow}>Type: {acc.accountType || 'N/A'}</Text>
                <Text style={styles.textRow}>Currency: {acc.currency || 'N/A'}</Text>
                <Text style={styles.tapPrompt}>Tap to view transfers →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal for Account Transactions */}
      <Modal visible={!!selectedAccountId} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Transfers / Transactions</Text>
            <TouchableOpacity onPress={() => setSelectedAccountId(null)}>
              <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>

          {loadingTx ? (
            <ActivityIndicator size="large" color="#0284c7" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView style={{ padding: 16 }}>
              {transactions.length === 0 ? (
                <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 20 }}>
                  No transactions found for this account.
                </Text>
              ) : (
                transactions.map((tx: TransactionItem) => (
                  <View key={tx.id} style={styles.txCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txDesc}>{tx.description || 'Transfer'}</Text>
                      <Text style={styles.txDate}>{tx.date}</Text>
                      <Text style={styles.txStatus}>{tx.status}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#ef4444' : '#16a34a' }]}>
                      {tx.amount} {tx.currency}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* In-App Bank Authorization Browser */}
      <Modal visible={!!authUrl} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bank Authentication</Text>
            <TouchableOpacity onPress={() => setAuthUrl(null)}>
              <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {authUrl && (
            <WebView
              source={{ uri: authUrl }}
              onNavigationStateChange={handleNavigationStateChange}
              startInLoadingState
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', marginTop: 30 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 8, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  bankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  bankName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  bankId: { fontSize: 12, color: '#64748b' },
  button: { backgroundColor: '#0284c7', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  accountBox: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 6, marginVertical: 6 },
  textRow: { fontSize: 13, color: '#334155', marginTop: 3 },
  error: { color: '#ef4444', marginBottom: 12 },
  modalHeader: { height: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  modalTitle: { fontWeight: 'bold', fontSize: 16 },
  tapPrompt: { fontSize: 12, color: '#0284c7', fontWeight: '600', marginTop: 6 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 8, marginBottom: 10, elevation: 1 },
  txDesc: { fontWeight: '600', fontSize: 14, color: '#0f172a' },
  txDate: { fontSize: 12, color: '#64748b', marginTop: 2 },
  txStatus: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txAmount: { fontWeight: 'bold', fontSize: 15 },
  switchBankButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  switchBankButtonText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
  },
});