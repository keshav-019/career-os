import { useState } from "react";
import { Image, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { Card, ErrorText, GhostButton, PrimaryButton, TextField } from "../../components/ui/Primitives";
import type { AuthStackParamList } from "../../navigation/types";

const careerLogo = require("../../../assets/icon.png");

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { colors, fontSize } = useTheme();
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email above first, then tap Forgot password.");
      return;
    }
    try {
      await resetPassword(email);
      setNotice(`Password reset email sent to ${email.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 20 }}>
      <View style={{ alignItems: "center", gap: 10 }}>
        <Image source={careerLogo} style={{ width: 72, height: 72, borderRadius: 20 }} resizeMode="contain" />
        <Text style={{ color: colors.text, fontSize: fontSize.xxl, fontWeight: "900" }}>CareerOS</Text>
        <Text style={{ color: colors.muted, fontSize: fontSize.base }}>Sign in to continue</Text>
      </View>

      <Card>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="********" />
        {error ? <ErrorText text={error} /> : null}
        {notice ? <Text style={{ color: colors.success, fontSize: fontSize.sm }}>{notice}</Text> : null}
        <PrimaryButton label="Sign In" onPress={() => void handleSignIn()} loading={submitting} />
        <GhostButton label="Forgot password?" onPress={() => void handleForgotPassword()} />
      </Card>

      <GhostButton label="Create an account" onPress={() => navigation.navigate("Signup")} />
    </View>
  );
}
