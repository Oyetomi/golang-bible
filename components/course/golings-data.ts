// Auto-authored exercise set for the in-browser Golings track.
// Each exercise ships a BROKEN, editable program; the learner fixes it and runs
// it on Codapi (real Go). It passes when the clean run's stdout contains `expect`.
// Every broken→fixed pair was go-run verified (broken fails / fixed prints expect).

export type GolingExercise = {
  id: string;
  title: string;
  topic: string;
  code: string; // broken starter, editable
  expect: string; // substring stdout must contain on a clean run to pass
  hint: string;
  explain: string;
};

export const GOLINGS: GolingExercise[] = [
  {
    id: "variables",
    title: "Variables",
    topic: "Fundamentals",
    code: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// FIX: x is used but never declared. Declare it as an int = 5.\n\tfmt.Println(\"x =\", x)\n}",
    expect: "x = 5",
    hint: "Go needs every variable declared. Add `x := 5` (or `var x int = 5`) on its own line before the Println.",
    explain: "Go has no implicit declaration — using x before declaring it is a compile error. := infers the type from the value.",
  },
  {
    id: "types",
    title: "Types & conversion",
    topic: "Fundamentals",
    code: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tvar i int = 10\n\tvar f float64 = 2.5\n\t// FIX: Go won't add int and float64 directly. Convert i to float64.\n\tfmt.Println(\"sum =\", i+f)\n}",
    expect: "sum = 12.5",
    hint: "Go has no implicit numeric conversion. Wrap i: float64(i) + f.",
    explain: "Mixing int and float64 in one expression is a compile error — Go forces an explicit conversion so you can't lose precision by accident.",
  },
  {
    id: "functions",
    title: "Functions & returns",
    topic: "Fundamentals",
    code: "package main\n\nimport \"fmt\"\n\n// FIX: declare the return type so this function can return an int.\nfunc add(a, b int) {\n\treturn a + b\n}\n\nfunc main() {\n\tfmt.Println(\"add =\", add(3, 4))\n}",
    expect: "add = 7",
    hint: "A function that returns a value must declare the type after the parameter list: func add(a, b int) int {",
    explain: "Without a declared return type, `return a + b` is a compile error and the call can't be used as a value.",
  },
  {
    id: "slices",
    title: "Slices grow with append",
    topic: "Data",
    code: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tnums := []int{1, 2, 3}\n\t// FIX: add 4 to the slice using append (re-assign the result).\n\tfmt.Println(\"nums =\", nums, \"len =\", len(nums))\n}",
    expect: "nums = [1 2 3 4] len = 4",
    hint: "append returns a new slice header — you must assign it back: nums = append(nums, 4).",
    explain: "append may reallocate, so it returns the (possibly new) slice. Ignoring its return value is the classic slice bug.",
  },
  {
    id: "maps",
    title: "Maps must be made",
    topic: "Data",
    code: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// FIX: this nil map panics on write. Initialize it with make.\n\tvar m map[string]int\n\tm[\"go\"] = 1\n\tfmt.Println(\"m[go] =\", m[\"go\"])\n}",
    expect: "m[go] = 1",
    hint: "A nil map can be read but not written. Create it: m := make(map[string]int).",
    explain: "Reading a missing key is fine (zero value), but writing to a nil map panics. make allocates the map.",
  },
  {
    id: "structs",
    title: "Structs & fields",
    topic: "Data",
    code: "package main\n\nimport \"fmt\"\n\ntype Point struct {\n\tX, Y int\n}\n\nfunc main() {\n\t// FIX: set p.Y to 7 so the sum is 12.\n\tp := Point{X: 5}\n\tfmt.Println(\"sum =\", p.X+p.Y)\n}",
    expect: "sum = 12",
    hint: "After p := Point{X: 5}, set the field: p.Y = 7.",
    explain: "An omitted struct field takes its zero value (0 here). Assign p.Y to change it.",
  },
  {
    id: "pointers",
    title: "Pointers mutate the original",
    topic: "Data",
    code: "package main\n\nimport \"fmt\"\n\n// FIX: take a pointer so the caller's value is changed.\nfunc double(n int) {\n\tn *= 2\n}\n\nfunc main() {\n\tx := 21\n\tdouble(&x)\n\tfmt.Println(\"x =\", x)\n}",
    expect: "x = 42",
    hint: "Pass *int and dereference: func double(n *int) { *n *= 2 }. The call already sends &x.",
    explain: "Go is pass-by-value — to mutate the caller's variable, pass its address and dereference.",
  },
  {
    id: "methods",
    title: "Pointer receivers",
    topic: "Methods",
    code: "package main\n\nimport \"fmt\"\n\ntype Counter struct{ n int }\n\n// FIX: use a pointer receiver so Inc actually changes the counter.\nfunc (c Counter) Inc() {\n\tc.n++\n}\n\nfunc main() {\n\tc := Counter{}\n\tc.Inc()\n\tc.Inc()\n\tfmt.Println(\"n =\", c.n)\n}",
    expect: "n = 2",
    hint: "A value receiver mutates a copy. Use a pointer receiver: func (c *Counter) Inc().",
    explain: "With a value receiver, Inc increments a copy and the change is lost. A pointer receiver mutates the original.",
  },
  {
    id: "interfaces",
    title: "Satisfying an interface",
    topic: "Methods",
    code: "package main\n\nimport \"fmt\"\n\ntype Speaker interface{ Speak() string }\n\ntype Dog struct{}\n\n// FIX: give Dog a Speak() string method so it satisfies Speaker.\nfunc main() {\n\tvar s Speaker = Dog{}\n\tfmt.Println(\"says:\", s.Speak())\n}",
    expect: "says: woof",
    hint: "Interfaces are satisfied implicitly — just add the method: func (Dog) Speak() string { return \"woof\" }",
    explain: "Go interfaces need no 'implements' keyword. A type satisfies Speaker the moment it has a Speak() string method.",
  },
  {
    id: "errors",
    title: "Errors are values",
    topic: "Errors",
    code: "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\nfunc check(n int) error {\n\tif n < 0 {\n\t\t// FIX: return an error here instead of nil.\n\t\treturn nil\n\t}\n\treturn nil\n}\n\nfunc main() {\n\terr := check(-1)\n\tif err != nil {\n\t\tfmt.Println(\"error:\", err)\n\t} else {\n\t\tfmt.Println(\"no error\")\n\t}\n}",
    expect: "error: negative",
    hint: "Build and return an error value: return errors.New(\"negative\").",
    explain: "Errors are ordinary return values in Go. Return a non-nil error to signal failure; the caller checks err != nil.",
  },
  {
    id: "closures",
    title: "Closures capture state",
    topic: "Functions",
    code: "package main\n\nimport \"fmt\"\n\n// FIX: return a function that increments and returns n each call.\nfunc counter() func() int {\n\tn := 0\n\treturn nil\n}\n\nfunc main() {\n\tnext := counter()\n\tfmt.Println(next(), next(), next())\n}",
    expect: "1 2 3",
    hint: "Return a closure over n: return func() int { n++; return n }.",
    explain: "The returned function captures n by reference, so n persists across calls — 1, 2, 3.",
  },
  {
    id: "goroutines",
    title: "Wait for a goroutine",
    topic: "Concurrency",
    code: "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc main() {\n\tvar wg sync.WaitGroup\n\tresult := 0\n\twg.Add(1)\n\tgo func() {\n\t\t// FIX: signal the WaitGroup when this goroutine finishes.\n\t\tresult = 42\n\t}()\n\twg.Wait()\n\tfmt.Println(\"result =\", result)\n}",
    expect: "result = 42",
    hint: "Call wg.Done() when the goroutine finishes — easiest as the first line: defer wg.Done().",
    explain: "wg.Wait() blocks until the counter hits zero. Without wg.Done(), it would deadlock; defer guarantees the signal.",
  },
  {
    id: "channels",
    title: "Send & receive on a channel",
    topic: "Concurrency",
    code: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tch := make(chan int, 1)\n\t// FIX: send the value 9 into the channel before receiving.\n\tv := <-ch\n\tfmt.Println(\"got =\", v)\n}",
    expect: "got = 9",
    hint: "Send before you receive: ch <- 9 (the channel is buffered, so this won't block).",
    explain: "A receive blocks until a value is available. The buffered channel lets the send complete without a second goroutine.",
  },
];
