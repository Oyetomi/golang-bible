package main

import "fmt"

func genRebac() {
	code := `
func (e *Engine) Check(user, rel, obj string) bool {
	if e.has(user, rel, obj) {
		return true // a direct tuple: user has rel on obj
	}
	parent, parentRel, ok := e.inherit(obj, rel) // the schema: "rel here" = "parentRel there"
	return ok && e.Check(user, parentRel, parent)
}`
	t := New("Check(alice, approver, evidence): follow inheritance until a tuple says yes", code)
	t.Nodes = []M{
		{"id": "alice", "x": 30, "y": 60}, {"id": "bob", "x": 30, "y": 120},
		{"id": "org", "x": 95, "y": 90}, {"id": "prog", "x": 160, "y": 90}, {"id": "ctrl", "x": 225, "y": 90}, {"id": "evid", "x": 280, "y": 90},
	}
	t.Edges = [][]any{{"alice", "org"}, {"bob", "org"}, {"org", "prog"}, {"prog", "ctrl"}, {"ctrl", "evid"}}
	// tuples: alice is admin of org; bob is only a member (viewer) of org
	type tup struct{ user, rel, obj string }
	tuples := []tup{{"alice", "admin", "org"}, {"bob", "member", "org"}}
	has := func(u, r, o string) bool {
		for _, x := range tuples {
			if x.user == u && x.rel == r && x.obj == o {
				return true
			}
		}
		return false
	}
	// schema: approver on evid = approver on ctrl; approver on ctrl = owner on prog; owner on prog = admin on org
	inherit := map[string][3]string{
		"evid|approver": {"ctrl", "approver", "evidence inherits its approvers from the control it belongs to"},
		"ctrl|approver": {"prog", "owner", "a control's approvers are the owners of its audit program"},
		"prog|owner":    {"org", "admin", "a program is owned by the admins of its organization"},
	}
	name := map[string]string{"evid": "evidence", "ctrl": "control", "prog": "program", "org": "org"}
	for _, user := range []string{"alice", "bob"} {
		states := map[string]string{}
		var lit []string
		gv := func(at string) M {
			s := M{}
			for k, v := range states {
				s[k] = v
			}
			s[user] = "visit"
			return M{"k": "graph", "label": "relationship graph (blue = being checked, green = proved, red = dead end)", "states": s, "edges": cp(lit), "at": at}
		}
		var check func(rel, obj string) bool
		check = func(rel, obj string) bool {
			states[obj] = "frontier"
			t.Step("if e.has(user, rel, obj)", fmt.Sprintf("%s: is there a direct tuple  %s  %s  %s?", user, user, rel, name[obj]), "neutral", M{"user": user, "rel": rel, "obj": name[obj]}, gv(obj))
			if has(user, rel, obj) {
				states[obj] = "done"
				lit = append(lit, user+"-"+obj)
				t.Step("return true // a direct tuple", fmt.Sprintf("Yes: the tuple '%s %s %s' is stored. This is the end of the search, and the answer is true.", user, rel, name[obj]), "solution", M{"user": user, "rel": rel, "obj": name[obj]}, gv(obj))
				return true
			}
			in, ok := inherit[obj+"|"+rel]
			if !ok {
				states[obj] = "reject"
				t.Step("return ok && e.Check(", fmt.Sprintf("No tuple, and the schema has no inheritance rule for '%s' on %s. Dead end: false.", rel, name[obj]), "problem", M{"user": user, "rel": rel, "obj": name[obj]}, gv(obj))
				return false
			}
			t.Step("parent, parentRel, ok := e.inherit(obj, rel)", fmt.Sprintf("No direct tuple. But the schema says: %s. So the question becomes: does %s have '%s' on the %s?", in[2], user, in[1], name[in[0]]), "neutral", M{"user": user, "rel": rel, "obj": name[obj]}, gv(obj))
			lit = append(lit, obj+"-"+in[0])
			okk := check(in[1], in[0])
			if okk {
				states[obj] = "done"
			} else {
				states[obj] = "reject"
			}
			return okk
		}
		res := check("approver", "evid")
		msg := fmt.Sprintf("%s CAN approve the evidence: the answer travelled back up the chain, evidence ← control ← program ← org, with no role ever stored on the evidence itself.", user)
		beat := "solution"
		if !res {
			msg = fmt.Sprintf("%s CANNOT approve: %s is only a 'member' of the org, and the schema needs 'admin' at the end of the chain. Deny by default: no path, no access.", user, user)
			beat = "problem"
		}
		t.Step("return ok && e.Check(", msg, beat, M{"user": user, "allowed": res}, gv(""))
	}
	t.Save("rebac")
}
