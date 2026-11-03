import 'package:flutter/material.dart';

// Colors copied from the website's CSS variables (web/src/index.css) so both clients
// look like the OpsFlow mockups.
const Color bgColor = Color(0xFF0D1117);
const Color cardColor = Color(0xFF161B22);
const Color borderColor = Color(0xFF30363D);
const Color inputBorderColor = Color(0xFF6E7681);
const Color textColor = Color(0xFFE6EDF3);
const Color mutedColor = Color(0xFF9DA7B3);
const Color accentColor = Color(0xFF7EE787);
const Color buttonColor = Color(0xFF238636);
const Color errorColor = Color(0xFFFF7B72);
const Color dangerButtonColor = Color(0xFFB62324);

const String monoFont = 'monospace';

TextStyle monoStyle({double size = 14, Color color = accentColor, FontWeight weight = FontWeight.w700}) {
  return TextStyle(fontFamily: monoFont, fontSize: size, color: color, fontWeight: weight);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: buttonColor,
    brightness: Brightness.dark,
  ).copyWith(
    surface: bgColor,
    onSurface: textColor,
    onSurfaceVariant: mutedColor,
    primary: accentColor,
    onPrimary: bgColor,
    error: errorColor,
    onError: bgColor,
    outline: inputBorderColor,
    outlineVariant: borderColor,
    surfaceContainerHighest: cardColor,
  );

  final roundedBorder = RoundedRectangleBorder(borderRadius: BorderRadius.circular(6));
  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(6),
    borderSide: const BorderSide(color: inputBorderColor),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: bgColor,
    canvasColor: cardColor,
    dividerColor: borderColor,
    appBarTheme: const AppBarTheme(
      backgroundColor: bgColor,
      foregroundColor: textColor,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: Border(bottom: BorderSide(color: borderColor)),
    ),
    cardTheme: CardThemeData(
      color: cardColor,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: borderColor),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: cardColor,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: borderColor),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: bgColor,
      border: inputBorder,
      enabledBorder: inputBorder,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: accentColor, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: errorColor),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: errorColor, width: 2),
      ),
      labelStyle: const TextStyle(color: mutedColor),
      helperStyle: const TextStyle(color: mutedColor),
      errorStyle: const TextStyle(color: errorColor, fontWeight: FontWeight.w600),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: buttonColor,
        foregroundColor: Colors.white,
        disabledBackgroundColor: const Color(0xFF21262D),
        disabledForegroundColor: mutedColor,
        minimumSize: const Size(64, 48),
        shape: roundedBorder,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: accentColor,
        side: const BorderSide(color: accentColor),
        minimumSize: const Size(64, 48),
        shape: roundedBorder,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: accentColor),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: buttonColor,
      foregroundColor: Colors.white,
      shape: roundedBorder,
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected) ? buttonColor : null,
      ),
      checkColor: const WidgetStatePropertyAll(Colors.white),
      side: const BorderSide(color: inputBorderColor, width: 1.5),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: accentColor,
      linearTrackColor: borderColor,
    ),
  );
}

// "[ ] OpsFlow" with the small tagline, like the website header.
class OpsFlowBrand extends StatelessWidget {
  const OpsFlowBrand({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'OpsFlow IT work orders',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('[ ]', style: monoStyle(size: 22)),
          const SizedBox(width: 8),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('OpsFlow', style: monoStyle(size: 18, color: textColor)),
              Text('IT WORK ORDERS', style: monoStyle(size: 9, color: mutedColor, weight: FontWeight.w400)),
            ],
          ),
        ],
      ),
    );
  }
}
