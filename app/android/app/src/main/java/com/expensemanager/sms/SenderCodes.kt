package com.expensemanager.sms

// Bank SMS sender headers look like "VM-HDFCBK" or "AD-HDFCBK-S". The code is the
// longest alphanumeric part. Mirrors senderCode() in packages/parser.
internal fun senderCode(address: String?): String {
  if (address == null) return ""
  return address.uppercase()
      .split(Regex("[^A-Z0-9]+"))
      .filter { it.isNotEmpty() }
      .maxByOrNull { it.length } ?: ""
}
