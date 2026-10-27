# Phase14 full-chain smoke test (ASCII only; bodies built via ConvertTo-Json)
$base = "http://localhost:8080/api/v1"
$rand = Get-Random -Minimum 100000 -Maximum 999999
$noA = "2026$rand"
$global:pass = 0
$global:fail = 0

# Chinese literals via JSON unicode escape
$SOLD = '"已售出"' | ConvertFrom-Json
$PENDING_CERT = '"待审核"' | ConvertFrom-Json
$WT_REPORT = '"求购"' | ConvertFrom-Json
$REJECT_REPORT = '"驳回举报"' | ConvertFrom-Json
$CAMPUS_EAST = '"东区"' | ConvertFrom-Json
$COND_LIGHT = '"轻微使用"' | ConvertFrom-Json
$TRADE_FACE = '"当面交易"' | ConvertFrom-Json

function Step($name, $script) {
  try {
    $r = & $script
    $global:pass++
    Write-Output "PASS  $name -> $r"
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
    $global:fail++
    Write-Output "FAIL  $name -> $msg"
  }
}

function PostJson($url, $obj, $headers) {
  $body = ($obj | ConvertTo-Json -Compress)
  if ($headers) { return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) }
  return Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
}
function PatchJson($url, $obj, $headers) {
  $body = ($obj | ConvertTo-Json -Compress)
  return Invoke-RestMethod -Uri $url -Method Patch -Headers $headers -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
}

# 1. register + login A
Step "01 register A" { PostJson "$base/auth/register" @{ studentNo = $noA; password = "abc12345"; nickname = "chain-test-a" } | Out-Null; "studentNo=$noA" }
$loginA = PostJson "$base/auth/login" @{ studentNo = $noA; password = "abc12345" }
$hA = @{ Authorization = "Bearer $($loginA.data.token)" }
Write-Output "PASS  01b login A"

# 2. A submit certification
Step "02 A submit cert" { PostJson "$base/users/me/certification" @{ studentNo = $noA; college = "CS"; proofImages = @("https://example.com/proof.jpg") } $hA | Out-Null; "submitted" }

# 3. admin review cert
$admin = PostJson "$base/auth/login" @{ studentNo = "admin"; password = "admin123" }
$hAdmin = @{ Authorization = "Bearer $($admin.data.token)" }
Step "03 admin pass cert" {
  $certs = Invoke-RestMethod -Uri "$base/admin/certifications?status=$([System.Web.HttpUtility]::UrlEncode($PENDING_CERT))&pageSize=50" -Headers $hAdmin
  $cert = $certs.data.list | Where-Object { $_.studentNo -eq $noA } | Select-Object -First 1
  if (-not $cert) { throw "cert not found for $noA" }
  PatchJson "$base/admin/certifications/$($cert.id)/review" @{ result = "pass" } $hAdmin | Out-Null
  "certId=$($cert.id) passed"
}

# 4. A publish goods
Step "04 A publish goods" {
  $g = PostJson "$base/goods" @{ title = "chain-test-math-book"; price = 15.5; categoryId = 1; conditionLevel = $COND_LIGHT; campus = $CAMPUS_EAST; tradeMethod = $TRADE_FACE; description = "phase14 chain test goods"; images = @() } $hA
  $script:goodsId = $g.data.id
  "goodsId=$goodsId (pending)"
}

# 5. admin review goods
Step "05 admin pass goods" { PatchJson "$base/admin/goods/$goodsId/review" @{ result = "pass" } $hAdmin | Out-Null; "goods $goodsId on sale" }

# 6. search (public)
Step "06 keyword search hit" {
  $s = Invoke-RestMethod -Uri "$base/goods?keyword=chain-test"
  if (($s.data.list | Where-Object { $_.id -eq $goodsId })) { "hit goodsId=$goodsId" } else { throw "search miss" }
}
Step "06b price range filter" {
  $s = Invoke-RestMethod -Uri "$base/goods?minPrice=10&maxPrice=20"
  if (($s.data.list | Where-Object { $_.id -eq $goodsId })) { "filter hit" } else { throw "filter miss" }
}

# 7. B login -> detail -> comment
$loginB = PostJson "$base/auth/login" @{ studentNo = "20211231245"; password = "abc12345" }
$hB = @{ Authorization = "Bearer $($loginB.data.token)" }
Step "07 B view detail" { $d = Invoke-RestMethod -Uri "$base/goods/$goodsId" -Headers $hB; if ($d.data.id -eq $goodsId) { "status=$($d.data.status)" } else { throw "detail error" } }
Step "08 B comment" {
  $c = PostJson "$base/goods/$goodsId/comments" @{ content = "still available?" } $hB
  $script:commentId = $c.data.id
  "commentId=$commentId"
}
Step "09 A reply" {
  $r = PostJson "$base/comments/$commentId/replies" @{ content = "yes, anytime" } $hA
  "replyId=$($r.data.id)"
}

# 10. B chat session + message
Step "10 B create chat session" {
  $s = PostJson "$base/chat/sessions" @{ goodsId = $goodsId } $hB
  $script:sessionId = $s.data.conversationId
  "sessionId=$sessionId"
}
Step "11 B send msg (REST)" {
  $m = PostJson "$base/chat/sessions/$sessionId/messages" @{ content = "meet at east canteen noon?" } $hB
  "msgId=$($m.data.id)"
}
Step "12 A fetch history" {
  $h = Invoke-RestMethod -Uri "$base/chat/sessions/$sessionId/messages" -Headers $hA
  if ($h.data.total -ge 1) { "history $($h.data.total) msgs" } else { throw "A got no message" }
}

# 13. B create order -> confirm -> complete
Step "13 B create order" {
  $o = PostJson "$base/orders" @{ goodsId = $goodsId; appointmentPlace = "east canteen"; remark = "chain test" } $hB
  $script:orderId = $o.data.id
  "orderId=$orderId orderNo=$($o.data.orderNo)"
}
Step "14 confirm order" { PatchJson "$base/orders/$orderId/status" @{ action = "confirm" } $hB | Out-Null; "confirmed" }
Step "15 complete order" {
  $r = PatchJson "$base/orders/$orderId/status" @{ action = "complete" } $hB
  "status=$($r.data.status)"
}
Step "15b goods marked sold" {
  $d = Invoke-RestMethod -Uri "$base/goods/$goodsId" -Headers $hB
  if ($d.data.status -eq $SOLD) { "sold" } else { throw "goods status=$($d.data.status), expect sold" }
}

# 16. want chain: A publish want -> B accept -> auto session
Step "16 A publish want" {
  $w = PostJson "$base/wants" @{ itemName = "chain-test-powerbank"; budget = 30; campus = $CAMPUS_EAST; remark = "urgent" } $hA
  $script:wantId = $w.data.id
  "wantId=$wantId"
}
Step "17 B accept want (auto session)" {
  $a = PostJson "$base/wants/$wantId/accept" @{} $hB
  "conversationId=$($a.data.conversationId)"
}

# 18. report chain: B report want -> admin reject
Step "18 B report want" {
  $rp = PostJson "$base/reports" @{ targetType = $WT_REPORT; targetId = $wantId; reason = "chain test report" } $hB
  $script:reportId = $rp.data.id
  "reportId=$reportId"
}
Step "19 admin reject report" {
  PatchJson "$base/admin/reports/$reportId/handle" @{ action = $REJECT_REPORT; result = "chain test: not valid" } $hAdmin | Out-Null
  "rejected"
}

Write-Output ""
Write-Output "===== SUMMARY: PASS=$global:pass FAIL=$global:fail ====="
